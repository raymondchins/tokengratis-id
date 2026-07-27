// Scoring/matching logic buat halaman /pilih ("Model apa buat gw?").
// PURE, no React, no I/O — unit-testable shape.
//
// SENGAJA dipisah kayak lib/filter.ts: cuma boleh import types (lib/types.ts)
// + pure helper (lib/ctxnum.ts). JANGAN import lib/data.ts atau apa pun yang
// transitif narik data/providers.json — caller (app/pilih/page.tsx) yang
// narik data lalu lempar slim payload ke sini + ke client.
//
// ATURAN ANTI-HALUSINASI (non-negotiable, lihat CLAUDE.md §CORE PRINCIPLE):
// - Reason/tradeoff di bawah CUMA dibangun dari field yang BENERAN ada di
//   data (Provider/Model). Field yang absent → "sumber tidak menyebutkan",
//   JANGAN PERNAH ditebak, JANGAN PERNAH sel/reason kosong yang menyesatkan.
// - rateLimit sumbernya string bebas ("200 RPM, 10 RPS", "1000 req/day",
//   null). Parsing di bawah ini BEST-EFFORT dan CUMA buat urutan (ranking)
//   internal — angka hasil parse TIDAK PERNAH ditampilkan sebagai klaim baru
//   ke user; yang ditampilkan selalu string `raw` apa adanya. Gagal parse →
//   unknown, dan unknown TIDAK PERNAH di-ranking di atas angka yang diketahui.

import type { Modality, Model } from "./types";
import { ctxNum } from "./ctxnum";

// ─── Public input shape ─────────────────────────────────────────────────────

/**
 * Payload provider yang diperluin wizard — SLIM subset dari Provider (ikutin
 * filosofi ProviderListItem di lib/data.ts: cuma field yang kepake yang
 * dikirim ke client). `models` dibawa penuh (Model udah lean by design —
 * cuma id/name/context/maxOutput/modality/rateLimit).
 */
export interface WizardProvider {
  slug: string;
  name: string;
  logo: string | null;
  flag: string | null;
  modalities: Modality[];
  models: Model[];
}

export type ContextThreshold = 8000 | 32000 | 128000 | 1000000;

export const CONTEXT_THRESHOLDS: { value: ContextThreshold; label: string }[] = [
  { value: 8000, label: "≥ 8K" },
  { value: 32000, label: "≥ 32K" },
  { value: 128000, label: "≥ 128K" },
  { value: 1000000, label: "≥ 1M" },
];

export interface WizardCriteria {
  /** null = semua modality, ga difilter. */
  modality: Modality | null;
  /** null = ga difilter by context. */
  minContext: ContextThreshold | null;
}

export function emptyWizardCriteria(): WizardCriteria {
  return { modality: null, minContext: null };
}

// ─── Rate limit: best-effort parse (internal ranking doang) ────────────────

export interface ParsedRateLimit {
  /** String apa adanya dari sumber. null = sumber ga nyebutin. */
  raw: string | null;
  /** Perkiraan requests/hari (RPM/RPD dikonversi) — INTERNAL, buat sort
   *  doang, TIDAK PERNAH ditampilkan sebagai klaim. null = ga bisa di-parse. */
  estimatedPerDay: number | null;
  /** Sumber eksplisit bilang "unlimited" / "no hard cap" dst — ini quote
   *  asli dari data, bukan tebakan. */
  explicitlyUnlimited: boolean;
}

const UNLIMITED_RE = /\bunlimited\b|no hard cap|no cap\b/i;
// "200 RPD", "1,000 requests/day", "200 req/day", "20 requests per day"
const RPD_RE =
  /([\d,]+(?:\.\d+)?)\s*(?:rpd|requests?\s*\/\s*day|req(?:uests?)?\s*\/\s*day|requests?\s+per\s+day)/i;
// "30 RPM", "20 requests/minute", "10 req/min", "5 requests per minute"
const RPM_RE =
  /([\d,]+(?:\.\d+)?)\s*(?:rpm|requests?\s*\/\s*min(?:ute)?|req(?:uests?)?\s*\/\s*min|requests?\s+per\s+minute)/i;

function toNum(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

/**
 * Parse string rateLimit bebas jadi perkiraan requests/hari. Best-effort:
 * banyak bentuk sumber ("$25/month credits", "Credit-metered", "Preview
 * limits") ga punya angka requests sama sekali → estimatedPerDay null
 * (unknown), bukan 0 dan bukan tebakan.
 */
export function parseRateLimit(raw: string | null): ParsedRateLimit {
  if (!raw || !raw.trim()) {
    return { raw: null, estimatedPerDay: null, explicitlyUnlimited: false };
  }

  const explicitlyUnlimited = UNLIMITED_RE.test(raw);

  const dayMatch = raw.match(RPD_RE);
  const minMatch = raw.match(RPM_RE);

  const perDayFromDay = dayMatch ? toNum(dayMatch[1]) : null;
  const perDayFromMin = minMatch ? toNum(minMatch[1]) * 1440 : null;

  let estimatedPerDay: number | null = null;
  if (perDayFromDay != null && perDayFromMin != null) {
    // Dua angka disebut (mis. "10 RPM, 100 RPD") → bottleneck asli = yang
    // paling kecil, itu yang beneran ngebatesin pemakaian harian.
    estimatedPerDay = Math.min(perDayFromDay, perDayFromMin);
  } else if (perDayFromDay != null) {
    estimatedPerDay = perDayFromDay;
  } else if (perDayFromMin != null) {
    estimatedPerDay = perDayFromMin;
  }

  return { raw, estimatedPerDay, explicitlyUnlimited };
}

/**
 * Skor generosity rate limit, buat ranking doang.
 * - explicit unlimited → skor tertinggi (klaim asli dari sumber).
 * - angka ke-parse → skor = angka itu sendiri (lebih gede = lebih longgar).
 * - unknown (ga ke-parse / null) → -1, SELALU di bawah angka yang diketahui.
 *   Never invent a number, never rank unknown above a known one.
 */
function rateLimitGenerosityScore(r: ParsedRateLimit): number {
  if (r.explicitlyUnlimited) return Number.POSITIVE_INFINITY;
  if (r.estimatedPerDay != null) return r.estimatedPerDay;
  return -1;
}

// ─── Modality keyword match ──────────────────────────────────────────────────
// Model.modality = string mentah dari sumber (mis. "Text + Vision",
// "embedding + rerank"). Regex di bawah SENGAJA DI-DUPLIKASI (bukan
// di-import) dari `facetsOf()` di scripts/lib/normalize.mjs — file itu bagian
// dari build pipeline (folder scripts/, dipegang agent lain), sementara
// lib/wizard.ts harus tetap pure/client-safe. Duplikasi kecil > coupling ke
// folder pipeline. Kalau keyword di pipeline berubah, sinkronkan manual di
// sini juga.
//
// ANTI-HALUSINASI: modality string kosong/null → ga match apa pun (ga nebak
// "text").

const MODALITY_KEYWORD_RE: Record<Modality, RegExp> = {
  text: /text|multimodal|llm|mllm|aigc|roleplay|reasoning|safety/i,
  vision: /vision/i,
  image: /image/i,
  audio: /audio|speech/i,
  video: /video/i,
  code: /\bcode\b/i,
  embeddings: /embed/i,
  reranking: /rerank/i,
};

function modelMatchesModality(m: Model, modality: Modality): boolean {
  if (!m.modality) return false;
  return MODALITY_KEYWORD_RE[modality].test(m.modality);
}

// ─── Match result shape ──────────────────────────────────────────────────────

export interface WizardMatchProvider {
  slug: string;
  name: string;
  logo: string | null;
  flag: string | null;
}

export interface WizardMatch {
  provider: WizardMatchProvider;
  model: Model;
  rateLimit: ParsedRateLimit;
  /** Alasan match, Bahasa Indonesia — dibangun HANYA dari field asli. */
  reasons: string[];
  /** Trade-off jujur: field yang ga disebutkan sumber buat model ini. */
  tradeoffs: string[];
  score: number;
}

function contextLabel(t: ContextThreshold): string {
  return CONTEXT_THRESHOLDS.find((c) => c.value === t)?.label ?? `≥ ${t}`;
}

function buildReasonsAndTradeoffs(
  m: Model,
  criteria: WizardCriteria,
  rateLimit: ParsedRateLimit,
): { reasons: string[]; tradeoffs: string[] } {
  const reasons: string[] = [];
  const tradeoffs: string[] = [];

  if (criteria.modality && m.modality && modelMatchesModality(m, criteria.modality)) {
    reasons.push(`Modality cocok — sumber tulis "${m.modality}" buat model ini.`);
  }

  if (criteria.minContext && m.context) {
    reasons.push(
      `Context window ${m.context} — memenuhi minimum ${contextLabel(criteria.minContext)} yang kamu pilih.`,
    );
  } else if (!criteria.minContext && m.context) {
    reasons.push(`Context window ${m.context}.`);
  }

  if (rateLimit.explicitlyUnlimited && rateLimit.raw) {
    reasons.push(`Rate limit: "${rateLimit.raw}" — sumber sebut ga ada batas ketat.`);
  } else if (rateLimit.raw) {
    reasons.push(`Rate limit: ${rateLimit.raw}.`);
  } else {
    tradeoffs.push("Rate limit: sumber tidak menyebutkan.");
  }

  if (!m.context) tradeoffs.push("Context window: sumber tidak menyebutkan.");
  if (!m.maxOutput) tradeoffs.push("Max output: sumber tidak menyebutkan.");
  if (rateLimit.raw && !rateLimit.explicitlyUnlimited && rateLimit.estimatedPerDay == null) {
    tradeoffs.push(
      "Rate limit ditulis dalam bentuk non-standar — ga bisa dibandingin ke provider lain secara angka.",
    );
  }

  if (reasons.length === 0) {
    reasons.push(`Salah satu model gratis dari provider ini.`);
  }

  return { reasons, tradeoffs };
}

/**
 * Skor buat sort hasil. Urutan bobot (dari yang paling nentuin):
 * 1) konfirmasi modality eksplisit (kalau user filter modality) — ini yang
 *    paling penting buat jawab "model apa buat gw", jadi bobotnya dominan.
 * 2) rate limit generosity (explicit unlimited > angka ke-parse, log-scaled
 *    biar provider dgn limit jutaan ga otomatis ngubur semua yang lain).
 * 3) context window (log-scaled).
 * 4) maxOutput ada (sinyal kecil, data lebih lengkap).
 * Unknown rate limit TIDAK dapet kontribusi skor (bukan 0 yang "menang" atas
 * angka kecil beneran — angka kecil beneran tetep > -1 unknown).
 */
function scoreModel(m: Model, rateLimit: ParsedRateLimit, criteria: WizardCriteria): number {
  let score = 0;

  if (criteria.modality && modelMatchesModality(m, criteria.modality)) {
    score += 100_000;
  }

  const rl = rateLimitGenerosityScore(rateLimit);
  if (rl === Number.POSITIVE_INFINITY) score += 10_000;
  else if (rl > 0) score += Math.log10(rl + 1) * 100;
  // rl === -1 (unknown) → +0.

  const cn = ctxNum(m.context);
  if (cn > 0) score += Math.log10(cn + 1) * 10;

  if (m.maxOutput) score += 1;

  return score;
}

/**
 * Cari SEMUA provider yang cocok sama criteria, udah diurut dari skor terbaik.
 * PURE — no side effect, no I/O. Satu provider cuma nyumbang model TERBAIK-nya
 * (biar hasil ga didominasi 1 provider yang modelnya banyak).
 *
 * SENGAJA ga motong di sini (dulu `limit = 5` di dalem). Pemanggil yang motong,
 * biar dia tau JUMLAH COCOK SEBENERNYA sekaligus jumlah yang ditampilin — dulu
 * `matches.length` yang udah kepotong dirender sebagai "N provider cocok", jadi
 * halaman bilang "5 provider cocok" padahal yang cocok 11. Itu pernyataan salah
 * di situs yang jualannya "kuitansi, bukan klaim".
 */
export function findWizardMatches(
  providers: WizardProvider[],
  criteria: WizardCriteria,
): WizardMatch[] {
  const bestPerProvider: WizardMatch[] = [];

  for (const p of providers) {
    if (criteria.modality && !p.modalities.includes(criteria.modality)) continue;

    let best: WizardMatch | null = null;

    for (const m of p.models) {
      if (criteria.modality && m.modality && !modelMatchesModality(m, criteria.modality)) {
        continue;
      }

      if (criteria.minContext) {
        if (!m.context) continue; // context ga disebutkan → ga bisa klaim penuhi threshold
        if (ctxNum(m.context) < criteria.minContext) continue;
      }

      const rateLimit = parseRateLimit(m.rateLimit);
      const score = scoreModel(m, rateLimit, criteria);

      if (!best || score > best.score) {
        const { reasons, tradeoffs } = buildReasonsAndTradeoffs(m, criteria, rateLimit);
        best = {
          provider: { slug: p.slug, name: p.name, logo: p.logo, flag: p.flag },
          model: m,
          rateLimit,
          reasons,
          tradeoffs,
          score,
        };
      }
    }

    if (best) bestPerProvider.push(best);
  }

  bestPerProvider.sort((a, b) => b.score - a.score);
  return bestPerProvider;
}
