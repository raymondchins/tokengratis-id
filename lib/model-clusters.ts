// Cross-provider "model X gratis di mana" clustering.
// ANTI-HALUSINASI: kita CUMA mengelompokkan model yang nama/id-nya cocok
// setelah normalisasi konservatif — kita TIDAK PERNAH mengklaim dua entri
// adalah "model yang sama" di luar itu (versi/kuantisasi bisa beda antar
// provider, dan itu diserahkan ke pembaca lewat disclaimer di halaman).
// Tiap provider tetap tampil dengan id/name VERBATIM dari sumbernya.
//
// Normalisasi di bawah adalah PORT STANDALONE dari `modelKey()` di
// scripts/lib/normalize.mjs (dipakai pipeline buat dedup model DALAM 1
// provider) — sengaja diimplementasi ulang di sini (bukan di-import) biar
// app/ ga nyebrang boundary ke scripts/ (ESM plain-JS, di luar app bundle).
// Kalau logic modelKey() di scripts berubah, sinkronkan manual di sini.

import { getAllProviders } from "./data";
import type { Model, SourceRef } from "./types";

// ─── Normalisasi key (conservative — collapse ke dash, BUKAN full alnum-smash,
// biar slug URL tetap kebaca & word-boundary ga ilang) ─────────────────────

const VENDOR_WORD =
  /^(openai|google|meta|mistralai|nvidia|anthropic|microsoft|cohere|moonshotai|moonshot|alibaba|poolside|inclusionai|nousresearch|nous)[\s:]+/i;

/** Panjang minimum key biar ga ada cluster ngaco dari singkatan pendek ("o1", "o3"). */
const MIN_KEY_LENGTH = 4;

function normalizeModelKey(nameOrId: string): string {
  let s = String(nameOrId || "")
    .toLowerCase()
    .trim();
  // id path-style: "@cf/meta/llama-x" / "moonshotai/kimi:free" → segmen terakhir
  if (s.includes("/")) s = s.split("/").pop() as string;
  // penanda free: "(free)", ":free", " free"
  s = s.replace(/\(free\)|:free\b|\bfree\b/g, " ");
  // prefix vendor bentuk colon: "Meta: ", "Google: "
  s = s.replace(/^[a-z0-9.\s]+:\s*/i, "");
  // prefix vendor bentuk kata: "OpenAI ", "Meta ", "Qwen "
  s = s.replace(VENDOR_WORD, "");
  // suffix kosmetik (NON-varian) — sengaja tanpa turbo/instant/versatile,
  // itu nandain model berbeda (lihat komentar modelKey() di normalize.mjs).
  s = s.replace(/[-_\s]?(instruct|chat|preview|latest)\b/g, "");
  // sisanya: non-alnum jadi satu dash, trim dash di ujung
  s = s.replace(/[^a-z0-9]+/g, "-");
  return s.replace(/^-+|-+$/g, "");
}

// ─── Public types ───────────────────────────────────────────────────────────

export interface ModelClusterEntry {
  provider: { slug: string; name: string };
  model: Pick<Model, "id" | "name" | "context" | "maxOutput" | "rateLimit" | "modality">;
  /** Provenance provider ini (sumber pertama/primary provider — sama konvensi
   *  dengan ModelsTable yang pakai `sources[0]`). */
  source: SourceRef;
}

export interface ModelCluster {
  /** Normalized key — dipakai sebagai slug URL, stabil antar sync selama nama modelnya ga berubah drastis. */
  slug: string;
  /** Nama model paling umum di cluster ini (mode count, tie-break alfabetis). */
  displayName: string;
  entries: ModelClusterEntry[];
}

// ─── Build clusters (memoized — data statis per build) ─────────────────────

let _clusters: ModelCluster[] | null = null;

export function getModelClusters(): ModelCluster[] {
  if (_clusters) return _clusters;

  const entriesByKey = new Map<string, ModelClusterEntry[]>();
  const nameCountsByKey = new Map<string, Map<string, number>>();

  for (const p of getAllProviders()) {
    // Satu entry per provider per key — kalau 1 provider punya >1 model yang
    // ke-normalize ke key yang sama (mis. dua varian), ambil yang pertama aja
    // biar count "distinct providers" ga ke-inflate oleh model dalam provider yang sama.
    const seenKeysForProvider = new Set<string>();
    for (const m of p.models) {
      const key = normalizeModelKey(m.name || m.id);
      if (!key || key.length < MIN_KEY_LENGTH) continue;
      if (seenKeysForProvider.has(key)) continue;
      seenKeysForProvider.add(key);

      const source = p.sources[0];
      if (!source) continue; // schema wajib >=1, tapi guard defensif

      const entry: ModelClusterEntry = {
        provider: { slug: p.slug, name: p.name },
        model: {
          id: m.id,
          name: m.name,
          context: m.context,
          maxOutput: m.maxOutput,
          rateLimit: m.rateLimit,
          modality: m.modality,
        },
        source,
      };

      const list = entriesByKey.get(key);
      if (list) list.push(entry);
      else entriesByKey.set(key, [entry]);

      const nameCounts = nameCountsByKey.get(key) ?? new Map<string, number>();
      nameCounts.set(m.name, (nameCounts.get(m.name) ?? 0) + 1);
      nameCountsByKey.set(key, nameCounts);
    }
  }

  const clusters: ModelCluster[] = [];
  for (const [key, entries] of entriesByKey) {
    const distinctProviders = new Set(entries.map((e) => e.provider.slug));
    if (distinctProviders.size < 2) continue; // hanya cluster lintas ≥2 provider

    const nameCounts = nameCountsByKey.get(key)!;
    // displayName = nama paling sering muncul. Tie-break: (1) hindari nama
    // yang keliatan kayak id mentah (mis. Cloudflare nyimpen name === id,
    // "@cf/qwen/qwen2.5-coder-32b-instruct" — jelek buat H1/title), lalu
    // (2) alfabetis (deterministik).
    const displayName = [...nameCounts.entries()]
      .sort(([nameA, countA], [nameB, countB]) => {
        if (countB !== countA) return countB - countA;
        const idA = looksLikeRawId(nameA) ? 1 : 0;
        const idB = looksLikeRawId(nameB) ? 1 : 0;
        if (idA !== idB) return idA - idB;
        return nameA.localeCompare(nameB);
      })[0][0];

    clusters.push({
      slug: key,
      displayName,
      entries: [...entries].sort((a, b) => a.provider.name.localeCompare(b.provider.name)),
    });
  }

  // Terbesar (paling banyak provider) duluan; tie-break alfabetis by slug.
  clusters.sort(
    (a, b) => b.entries.length - a.entries.length || a.slug.localeCompare(b.slug),
  );

  _clusters = clusters;
  return _clusters;
}

function looksLikeRawId(name: string): boolean {
  return name.includes("/") || name.startsWith("@");
}

export function getClusterBySlug(slug: string): ModelCluster | undefined {
  return getModelClusters().find((c) => c.slug === slug);
}
