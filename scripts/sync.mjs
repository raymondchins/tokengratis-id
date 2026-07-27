// Pipeline sync tokengratis.id — aggregator, bukan verifier.
// Orchestrator multi-sumber: jalanin tiap adapter (paralel) → merge/dedup →
// download logo → smoke test → tulis data/providers.json. Idempotent.
//
//   node scripts/sync.mjs
//   npm run sync
//
// Sumber (lihat scripts/adapters/*.mjs):
//   1. mnfst/awesome-free-llm-apis  (JSON bersih — prioritas #1)
//   2. freellm.net                  (HTML table — context/modality lengkap)
//   3. cheahjs/free-llm-api-resources (README markdown — rate limit presisi)
//   4. openrouter.ai/api/v1/models  (JSON live API — authoritative buat provider openrouter)
//
// Enrichment: setelah merge, gap-fill context/maxOutput dari models.dev
// (scripts/lib/enrich.mjs) — best-effort, ga pernah throw.
//
// LLM fallback: kalau sumber unstructured (freellm HTML / cheahjs markdown) gagal
// sanity floor DAN ANTHROPIC_API_KEY ada → re-fetch + re-parse via Claude Haiku
// (scripts/lib/llm-fallback.mjs). Hasil LLM tetap lewat sanity floor + smoke +
// diff guard. mnfst & openrouter (JSON bersih) ga butuh fallback.
//
// Shape guard (scripts/lib/shape-guard.mjs): sanity floor + diff guard di atas
// CUMA ngukur KUANTITAS (jumlah row/kolom/churn) — INCIDENT 2026-07-25 (freellm
// nyisipin kolom "Score", context keisi 81/45/40) lolos SEMUA guard itu karena
// jumlah baris/kolom ga berubah, cuma ARTI kolom yang geser. checkShape() ngukur
// BENTUK nilai tiap field, jalan di tiap output adapter (sebelum merge) DAN di
// output merged final (sebelum tulis). Fatal → skip source (adapter) / abort
// write (merged), persis kayak jalur skip/abort yang udah ada. Warn → selalu
// ditampilin, ga pernah nge-block.
//
// Reporting: tiap run nulis data/sync-report.json (counts + issues per source +
// apa yang di-skip) + append $GITHUB_STEP_SUMMARY kalau di CI. Workflow nightly
// baca sync-report.json buat isi body issue GitHub pas run gagal — supaya bukan
// cuma "cek log run", tapi source/rule/ratio/sample kelihatan langsung di email
// notifikasi issue (repo owner ga perlu Telegram/email digest terpisah).
//
// Anti-halusinasi: tiap adapter cuma mindahin field yang EKSPLISIT ada di
// sumbernya. Merge = gap-fill by priority (scripts/lib/merge.mjs). Ga nebak.

import {
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
  appendFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { fetchProviders as fetchMnfst } from "./adapters/mnfst.mjs";
import { fetchProviders as fetchFreellm } from "./adapters/freellm.mjs";
import { fetchProviders as fetchCheahjs } from "./adapters/cheahjs.mjs";
import { fetchProviders as fetchOpenRouter } from "./adapters/openrouter.mjs";
import { mergeProviders } from "./lib/merge.mjs";
import { enrichFromModelsDev } from "./lib/enrich.mjs";
import { llmParseSource, llmBackendAvailable } from "./lib/llm-fallback.mjs";
import { snapshotDiff } from "./lib/diff-guard.mjs";
import { checkSourceFloor, updateBaselines } from "./lib/source-sanity.mjs";
import { GENERIC_MODELS_PATTERN } from "./lib/normalize.mjs";
import { pingIndexNow } from "./lib/indexnow.mjs";
import { checkShape } from "./lib/shape-guard.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "providers.json");
const LOGO_DIR = join(__dirname, "..", "public", "logos");
const CHANGELOG_OUT = join(__dirname, "..", "data", "changelog.json");
const REPORT_OUT = join(__dirname, "..", "data", "sync-report.json");
const SITE_URL = "https://tokengratis.id";

// Report run yang lagi jalan — di-set di awal main(), dibaca ulang oleh
// top-level catch handler kalau ada exception yang GA lewat exit point yang
// udah nge-handle report sendiri (lihat bawah file). Module-scope karena
// catch handler di luar main().
let currentReport = null;

/** { providers, models } count buat satu ProviderPartial[]/Provider[] — dipakai
 * di 3 tempat (LLM fallback rescue, adapter accept loop, sanity floor check). */
function countOf(list) {
  return {
    providers: list.length,
    models: list.reduce((a, p) => a + (p.models?.length || 0), 0),
  };
}

/**
 * Ringkas satu ShapeGuardResult (dari checkShape(), scripts/lib/shape-guard.mjs)
 * jadi { hasFatal, fatal, warn }. Pure — no I/O, ga bergantung ke shape-guard.mjs
 * selain BENTUK objectnya — jadi testable standalone pakai object literal
 * sintetis (lihat catatan verifikasi di laporan agent / komentar bawah file).
 *
 * @param {{ok:boolean, issues:Array<Object>, stats:Object}|null|undefined} result
 * @returns {{ hasFatal: boolean, fatal: Array<Object>, warn: Array<Object> }}
 */
export function splitShapeIssues(result) {
  const issues = Array.isArray(result?.issues) ? result.issues : [];
  const fatal = issues.filter((i) => i.severity === "fatal");
  const warn = issues.filter((i) => i.severity === "warn");
  return { hasFatal: fatal.length > 0, fatal, warn };
}

/** Print warn-level shape issues — selalu ditampilin, ga pernah nge-block (bukan gate). */
function logShapeWarnings(label, warnIssues) {
  for (const w of warnIssues) {
    console.warn(`  ⚠ shape-guard [${label}] ${w.rule}: ${w.message}`);
  }
}

/** Print fatal-level shape issues — dipanggil pas mau skip source / abort write. */
function logShapeFatal(label, fatalIssues) {
  for (const f of fatalIssues) {
    console.error(`  ✗ shape-guard [${label}] ${f.rule}: ${f.message}`);
  }
}

/**
 * Report run ini — accumulate sepanjang main(), ditulis (finish()) di TIAP exit
 * point (sukses ATAU gagal). Konsumen:
 *   1. data/sync-report.json — historical record, ke-commit bareng providers.json
 *      pas run sukses (git add data/ di workflow udah nyakup file ini).
 *   2. Step "Buka/update issue" di workflow nightly — baca file ini dari disk
 *      DALAM job yang sama (belum tentu ke-commit kalau run gagal sebelum commit
 *      step) buat isi body issue GitHub dengan detail source/rule/ratio/sample,
 *      bukan cuma "cek log run".
 *   3. $GITHUB_STEP_SUMMARY — ringkasan Markdown di halaman run, human ga perlu
 *      buka raw log buat liat apa yang kejadian.
 */
export function createSyncReport() {
  return {
    generatedAt: new Date().toISOString(),
    outcome: "running",
    sources: {}, // { [label]: { status, reason?, providers?, models?, shapeIssues?, detail? } }
    skipped: [], // label sumber yang di-skip run ini (alasan apapun)
    merged: null, // { providers, models, shapeIssues }
    smokeTest: null, // { errors, warnings }
    diffGuard: null, // { ok, errors, warnings, stats, bypassed? }
    fatalIssues: [], // flattened ShapeIssue[] fatal (per-source + merged) — buat issue body
    warnIssues: [], // flattened ShapeIssue[] warn
  };
}

/**
 * Tulis data/sync-report.json. Best-effort — never throws (report gagal ditulis
 * ga boleh jatohin pipeline).
 * @param {ReturnType<typeof createSyncReport>} report
 */
export function writeSyncReport(report) {
  try {
    mkdirSync(join(__dirname, "..", "data"), { recursive: true });
    writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2) + "\n");
  } catch (e) {
    console.warn(`  ⚠ sync-report.json gagal ditulis: ${e.message}`);
  }
}

/**
 * Append ringkasan Markdown ke $GITHUB_STEP_SUMMARY (cuma ke-set di GitHub
 * Actions — no-op diam-diam di lokal, ga perlu setup apa-apa). Best-effort —
 * never throws.
 * @param {ReturnType<typeof createSyncReport>} report
 */
export function appendJobSummary(report) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  try {
    const ok = report.outcome.startsWith("ok");
    const lines = [`## Sync report — ${ok ? "✓" : "✗"} ${report.outcome}`, ""];

    lines.push("| Source | Status | Providers | Models |", "|---|---|---|---|");
    for (const [label, s] of Object.entries(report.sources)) {
      lines.push(
        `| ${label} | ${s.status}${s.reason ? ` (${s.reason})` : ""} | ${s.providers ?? "—"} | ${s.models ?? "—"} |`,
      );
    }

    if (report.merged) {
      lines.push("", `**Merged:** ${report.merged.providers} providers, ${report.merged.models} models`);
    }

    if (report.fatalIssues.length) {
      lines.push("", "### Fatal shape issues", "");
      for (const f of report.fatalIssues) {
        lines.push(
          `- \`${f.source}\` · rule \`${f.rule}\` · field \`${f.field}\` — ${f.count}/${f.total} ` +
            `(${((f.ratio ?? 0) * 100).toFixed(1)}%): ${f.message}`,
        );
        if (f.samples?.length) lines.push(`  - samples: ${JSON.stringify(f.samples)}`);
      }
    }

    if (report.warnIssues.length) {
      lines.push("", `### Warnings (${report.warnIssues.length})`, "");
      for (const w of report.warnIssues.slice(0, 20)) {
        lines.push(`- \`${w.source}\` · ${w.rule}: ${w.message}`);
      }
    }

    if (report.smokeTest?.errors?.length) {
      lines.push("", "### Smoke test errors", "", ...report.smokeTest.errors.map((e) => `- ${e}`));
    }

    if (report.diffGuard && !report.diffGuard.ok) {
      lines.push("", "### Snapshot guard errors", "", ...report.diffGuard.errors.map((e) => `- ${e}`));
    }

    if (report.crash) {
      lines.push("", "### Crash", "", `\`${report.crash.message}\``);
    }

    appendFileSync(path, lines.join("\n") + "\n");
  } catch (e) {
    console.warn(`  ⚠ job summary gagal ditulis: ${e.message}`);
  }
}

/** Tulis report JSON + job summary sekaligus — dipanggil di tiap exit point. */
function finish(report) {
  writeSyncReport(report);
  appendJobSummary(report);
}

// Tiap adapter: { label, fn }. Adapter yang gagal fetch ga boleh ngejatuhin
// seluruh pipeline — di-skip dengan warning (sumber lain tetep jalan).
const ADAPTERS = [
  { label: "mnfst/awesome-free-llm-apis", fn: fetchMnfst },
  { label: "freellm.net", fn: fetchFreellm },
  { label: "cheahjs/free-llm-api-resources", fn: fetchCheahjs },
  { label: "openrouter.ai/api/v1/models", fn: fetchOpenRouter },
];

// Slug provider yang dipegang otoritatif oleh adapter openrouter — model list-nya
// dipakai sebagai ground truth (lihat langkah 2c di main()).
const OPENROUTER_LABEL = "openrouter.ai/api/v1/models";

// Registry buat LLM fallback: cuma sumber UNSTRUCTURED (HTML/markdown) yang
// regex-nya bisa drift saat markup sumber berubah. mnfst + openrouter = JSON
// bersih → ga butuh fallback. Tiap entri: { url, format } buat re-fetch + re-parse.
// `url` = URL mentah yang di-fetch adapter; `format` = hint buat prompt LLM.
const SOURCE_REGISTRY = {
  "freellm.net": {
    url: "https://freellm.net/models/",
    format: "html",
  },
  "cheahjs/free-llm-api-resources": {
    url: "https://raw.githubusercontent.com/cheahjs/free-llm-api-resources/main/README.md",
    format: "markdown",
  },
};

/**
 * LLM fallback buat satu sumber unstructured yang gagal sanity floor (atau
 * adapter-nya throw). Re-fetch URL sumber → llmParseSource() → re-cek sanity
 * floor pada hasil LLM. Lolos → return ProviderPartial[]; gagal/null → null
 * (caller skip sumber kayak biasa). TIDAK PERNAH throw.
 *
 * Cuma dipanggil kalau process.env.ANTHROPIC_API_KEY ada (di-cek caller).
 *
 * @param {string} label  - Nama sumber (key di SOURCE_REGISTRY + SOURCES).
 * @returns {Promise<Array<Object>|null>}
 */
async function tryLlmFallback(label) {
  const reg = SOURCE_REGISTRY[label];
  if (!reg) return null; // sumber ini ga di-registry (mis. JSON bersih) → no fallback

  // 1. Re-fetch raw source (llm-fallback ga fetch sendiri — kontraknya).
  let raw;
  try {
    // Mirror the adapter's request headers so the rescue re-fetch sees the same
    // response the failing adapter did (freellm.net serves different markup to a
    // bare UA). Without this the LLM could re-parse a blocked/different page.
    const res = await fetch(reg.url, {
      signal: AbortSignal.timeout(20_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; tokengratis-sync/1.0; +https://tokengratis.id)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.text();
  } catch (e) {
    console.warn(`  ⚠ LLM fallback ${label}: re-fetch gagal (${e.message}) — skip.`);
    return null;
  }

  // 2. Re-parse via Claude Haiku (anti-halusinasi prompt + structured output).
  const partials = await llmParseSource({
    sourceName: label,
    url: reg.url,
    format: reg.format,
    raw,
  });
  if (!partials || partials.length === 0) return null; // null = skip (warn sudah dari llm-fallback)

  // 3. Hasil LLM HARUS tetap lolos sanity floor — ga ada bypass guard.
  const { providers: provCount, models: modelCount } = countOf(partials);
  const floor = checkSourceFloor(label, provCount, modelCount);
  if (!floor.ok) {
    console.warn(`  ⚠ LLM fallback ${label} masih di bawah sanity floor: ${floor.message} — skip.`);
    return null;
  }

  console.log(`  ✓ LLM fallback rescued ${label}: ${provCount} provider, ${modelCount} model`);
  return partials;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Download favicon tiap provider ke public/logos/<slug>.png. Gagal → logo null (UI fallback flag/globe). */
async function downloadLogos(providers) {
  mkdirSync(LOGO_DIR, { recursive: true });
  await Promise.all(
    providers.map(async (p) => {
      if (!p.domain) {
        p.logo = null;
        return;
      }
      try {
        // 3 percobaan + backoff. 24 request bareng ke satu layanan favicon
        // gampang kena throttle/timeout, dan sekali gagal logonya ilang sampai
        // sync berikutnya KEBETULAN berhasil (persis yang kejadian ke aion-labs:
        // domain ke-derive bener, PNG-nya ga pernah nyampe disk).
        let buf = null;
        let lastErr = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) await sleep(400 * attempt);
          try {
            const r = await fetch(
              `https://www.google.com/s2/favicons?sz=128&domain=${p.domain}`,
              { signal: AbortSignal.timeout(8000) },
            );
            if (!r.ok) throw new Error(String(r.status));
            const b = Buffer.from(await r.arrayBuffer());
            if (b.length < 100) throw new Error("empty favicon");
            buf = b;
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (!buf) throw lastErr ?? new Error("favicon unavailable");
        writeFileSync(join(LOGO_DIR, `${p.slug}.png`), buf);
        p.logo = `/logos/${p.slug}.png`;
      } catch {
        // A transient favicon hiccup shouldn't wipe a logo we already have on
        // disk from a prior successful sync — keep the existing PNG if present.
        p.logo = existsSync(join(LOGO_DIR, `${p.slug}.png`))
          ? `/logos/${p.slug}.png`
          : null;
      }
    }),
  );
}

/** Smoke test (PRD): tiap entry wajib punya source+syncedAt, ga ada sentinel nyangkut. */
function smokeTest(providers, report) {
  const errs = [];
  const warns = [];

  // Valid category values (null = not sourced, which is fine for cheahjs/freellm-only providers)
  const VALID_CATEGORIES = new Set(["provider_api", "inference_provider", null]);

  // GENERIC_MODELS_PATTERN (from lib/normalize.mjs, shared w/ cheahjs.mjs) —
  // catches fake models (generic descriptor ending in "models", no version/id
  // signal) that slip through merge.

  for (const p of providers) {
    // ── existing provenance checks ──────────────────────────────────────────
    if (!p.sources || p.sources.length === 0 || !p.syncedAt)
      errs.push(`${p.slug}: missing sources/syncedAt`);
    if (p.sources?.some((s) => !s.name || !s.url || !s.syncedAt))
      errs.push(`${p.slug}: source ref tidak lengkap`);
    if (p.modelCount === 0 && p.maxContext)
      errs.push(`${p.slug}: 0 models tapi maxContext keisi`);
    if (p.maxContext === "—" || p.maxContext === "-")
      errs.push(`${p.slug}: maxContext sentinel`);
    if (!p.slug || !p.name) errs.push(`${p.slug || "?"}: slug/name kosong`);

    // ── FIX 2a: category must be a valid enum value or null ─────────────────
    if (!VALID_CATEGORIES.has(p.category))
      errs.push(
        `${p.slug}: invalid category "${p.category}" — must be "provider_api", "inference_provider", or null`,
      );

    // ── FIX 2b: no model may have a meta-row id/name (section descriptor, not callable model) ──
    if (Array.isArray(p.models)) {
      for (const m of p.models) {
        const suspicious =
          (GENERIC_MODELS_PATTERN.test(m.id || "") && !/[\d\-\/]/.test(m.id || "")) ||
          (GENERIC_MODELS_PATTERN.test(m.name || "") && !/[\d\-\/]/.test(m.name || ""));
        if (suspicious)
          errs.push(
            `${p.slug}: model "${m.name}" (id="${m.id}") looks like a section descriptor, not a real model`,
          );
      }
    }

    // ── FIX 2c: warn on modality === "" (should be null, never empty string) ──
    if (Array.isArray(p.models)) {
      for (const m of p.models) {
        if (m.modality === "")
          warns.push(`${p.slug} › ${m.id}: modality is "" — should be null`);
      }
    }
  }

  if (report) report.smokeTest = { errors: errs, warnings: warns };

  if (warns.length) {
    console.warn("⚠ Smoke test warnings:\n" + warns.join("\n"));
  }
  if (errs.length) {
    console.error("✗ Smoke test FAILED:\n" + errs.join("\n"));
    if (report) {
      report.outcome = "aborted-smoke-test";
      finish(report);
    }
    process.exit(1);
  }
  console.log("✓ Smoke test passed");
}

/**
 * Diff snapshot lama (prevProviders, dari data/providers.json sebelum run ini)
 * vs providers final run ini → fakta data buat data/changelog.json. Cuma diff
 * murni (slug/model id presence) — ga ada klaim baru, ga nebak.
 * Return null kalau ga ada perubahan sama sekali (skip entry).
 *
 * @param {Array<Object>} prev
 * @param {Array<Object>} next
 * @returns {{providersAdded: Array<{slug:string,name:string}>, providersRemoved: Array<{slug:string,name:string}>, models: Array<{provider:string,added:string[],removed:string[]}>} | null}
 */
function computeChangelogDiff(prev, next) {
  const prevBySlug = new Map(prev.map((p) => [p.slug, p]));
  const nextBySlug = new Map(next.map((p) => [p.slug, p]));

  const providersAdded = next
    .filter((p) => !prevBySlug.has(p.slug))
    .map((p) => ({ slug: p.slug, name: p.name }));
  const providersRemoved = prev
    .filter((p) => !nextBySlug.has(p.slug))
    .map((p) => ({ slug: p.slug, name: p.name }));

  const models = [];
  for (const p of next) {
    const prevP = prevBySlug.get(p.slug);
    if (!prevP) continue; // provider baru — udah kecatat di providersAdded
    const prevIds = new Set((prevP.models || []).map((m) => m.id));
    const nextIds = new Set((p.models || []).map((m) => m.id));
    const added = (p.models || []).filter((m) => !prevIds.has(m.id)).map((m) => m.name);
    const removed = (prevP.models || []).filter((m) => !nextIds.has(m.id)).map((m) => m.name);
    if (added.length || removed.length) {
      models.push({ provider: p.name, added, removed });
    }
  }

  if (providersAdded.length === 0 && providersRemoved.length === 0 && models.length === 0) {
    return null;
  }
  return { providersAdded, providersRemoved, models };
}

/**
 * Read-modify-write data/changelog.json: append entry hari ini (atau replace
 * kalau re-run hari yang sama → idempotent), keep max 60 entries (drop oldest).
 * Best-effort — never throws (caller wraps in try/catch juga, defense-in-depth).
 *
 * @param {ReturnType<typeof computeChangelogDiff>} diff
 * @returns {{wrote: boolean, date?: string, error?: string}}
 */
function updateChangelog(diff) {
  if (!diff) return { wrote: false };
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    let entries = [];
    try {
      if (existsSync(CHANGELOG_OUT)) {
        const parsed = JSON.parse(readFileSync(CHANGELOG_OUT, "utf8"));
        if (Array.isArray(parsed)) entries = parsed;
      }
    } catch {
      entries = [];
    }

    const entry = { date: today, ...diff };
    const idx = entries.findIndex((e) => e.date === today);
    if (idx >= 0) entries[idx] = entry; // re-run hari sama → replace, bukan duplikat
    else entries.unshift(entry); // newest-first di storage

    if (entries.length > 60) entries = entries.slice(0, 60); // drop oldest

    writeFileSync(CHANGELOG_OUT, JSON.stringify(entries, null, 2) + "\n");
    return { wrote: true, date: today };
  } catch (e) {
    return { wrote: false, error: e.message };
  }
}

async function main() {
  const mergeRunAt = new Date().toISOString();
  const report = createSyncReport();
  currentReport = report;

  // 0. Baca snapshot lama (data/providers.json yang udah ke-commit) buat
  //    snapshot-diff guard di langkah 4. First run / file korup → [] (guard skip).
  let prevProviders = [];
  try {
    if (existsSync(OUT)) {
      const parsed = JSON.parse(readFileSync(OUT, "utf8"));
      // Guard against valid-but-non-array JSON (e.g. {} / null) reaching
      // snapshotDiff, whose first-run check is `!prev || prev.length===0` — a
      // truthy non-array slips past it and then crashes on `prev.map(...)`.
      if (Array.isArray(parsed)) prevProviders = parsed;
    }
  } catch {
    prevProviders = [];
  }

  // 1. Fetch semua sumber paralel. Sumber gagal → skip (jangan jatohin pipeline).
  //    `acceptedCounts` nyimpen count per-source yang LOLOS (buat updateBaselines
  //    di langkah 5). `okLabels` = set label yang masuk merge (buat authoritative
  //    openrouter-models step di langkah 2c).
  const settled = await Promise.allSettled(ADAPTERS.map((a) => a.fn()));
  const partialGroups = [];
  const acceptedCounts = {};
  const okLabels = new Set();
  // Backend LLM fallback: "api" (ANTHROPIC_API_KEY) / "cli" (CLAUDE_CODE_OAUTH_TOKEN
  // atau login `claude` CLI lokal — kuota subscription) / null (fallback off).
  const llmBackend = llmBackendAvailable();
  const hasLlmKey = !!llmBackend;
  if (hasLlmKey) console.log(`  · LLM fallback siap (backend: ${llmBackend})`);

  // Sumber yang gagal (fetch error / parse collapse di bawah floor) dan
  // PUNYA entri di SOURCE_REGISTRY → kandidat LLM fallback. Dikumpulin dulu,
  // di-rescue serial setelah loop (re-fetch + API call, ga perlu paralel ketat).
  const fallbackCandidates = [];

  // Id model live dari adapter openrouter — ground truth buat langkah 2c.
  // WAJIB di-capture by-label DI SINI: sumber komunitas (mnfst dkk) juga punya
  // entri slug "openrouter", jadi nyari "group pertama yang ada openrouter" di
  // partialGroups bakal dapet punya mnfst (urutan adapter), bukan live API.
  let openrouterLiveIds = null;

  /** Catat partial group yang lolos: push ke merge + simpan count + tandai label. */
  function accept(label, value, provCount, modelCount) {
    console.log(`  ✓ ${label}: ${provCount} provider, ${modelCount} model`);
    partialGroups.push(value);
    acceptedCounts[label] = { providers: provCount, models: modelCount };
    okLabels.add(label);
    if (label === OPENROUTER_LABEL) {
      const orp = value.find((p) => p.slug === "openrouter");
      openrouterLiveIds = new Set((orp?.models || []).map((m) => m.id));
    }
  }

  settled.forEach((res, i) => {
    const label = ADAPTERS[i].label;
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      const { providers: provCount, models: modelCount } = countOf(res.value);
      // Sanity floor: fetch sukses tapi parse jeblok (markup sumber berubah →
      // regex cuma dapet sedikit row) → skip sumber ini, jangan korup merge.
      // Sumber lain + last-good gap-fill tetep jalan.
      const floor = checkSourceFloor(label, provCount, modelCount);
      if (!floor.ok) {
        console.warn(`  ⚠ ${label} di-SKIP (sanity floor): ${floor.message}`);
        report.sources[label] = {
          status: "skipped",
          reason: "sanity-floor",
          providers: provCount,
          models: modelCount,
          detail: floor.message,
        };
        report.skipped.push(label);
        if (SOURCE_REGISTRY[label] && hasLlmKey) fallbackCandidates.push(label);
        return;
      }

      // Shape guard: sanity floor di atas CUMA liat COUNT. INCIDENT 2026-07-25
      // (freellm nyisipin kolom "Score") lolos floor karena jumlah baris/kolom
      // TETAP sama — cuma ARTI kolom yang geser. checkShape() liat BENTUK nilai
      // tiap field (lihat scripts/adapters/freellm.mjs header buat kronologi).
      const shape = checkShape(res.value, { source: label });
      const { hasFatal, fatal, warn } = splitShapeIssues(shape);
      logShapeWarnings(label, warn);
      report.warnIssues.push(...warn);
      if (hasFatal) {
        logShapeFatal(label, fatal);
        console.warn(`  ⚠ ${label} di-SKIP (shape guard): ${fatal.map((f) => f.rule).join(", ")}`);
        report.fatalIssues.push(...fatal.map((f) => ({ ...f, source: f.source || label })));
        report.sources[label] = {
          status: "skipped",
          reason: "shape-fatal",
          providers: provCount,
          models: modelCount,
          shapeIssues: fatal,
        };
        report.skipped.push(label);
        if (SOURCE_REGISTRY[label] && hasLlmKey) fallbackCandidates.push(label);
        return;
      }

      accept(label, res.value, provCount, modelCount);
      report.sources[label] = { status: "ok", providers: provCount, models: modelCount, shapeIssues: warn };
    } else {
      const reason = res.status === "rejected" ? res.reason : "bukan array";
      console.warn(`  ⚠ ${label} di-SKIP: ${reason?.message || reason}`);
      report.sources[label] = { status: "skipped", reason: "fetch-error", detail: reason?.message || String(reason) };
      report.skipped.push(label);
      if (SOURCE_REGISTRY[label] && hasLlmKey) fallbackCandidates.push(label);
    }
  });

  // 1b. LLM fallback buat sumber unstructured yang gagal — re-fetch + re-parse
  //     via Claude Haiku, lalu re-cek sanity floor. Lolos → masuk merge sama
  //     kayak adapter biasa. Cuma jalan kalau ANTHROPIC_API_KEY ada (di-cek
  //     waktu ngumpulin fallbackCandidates).
  for (const label of fallbackCandidates) {
    const rescued = await tryLlmFallback(label);
    if (!rescued) continue; // tryLlmFallback udah warn — report.sources[label] tetep "skipped"

    const { providers: provCount, models: modelCount } = countOf(rescued);

    // Shape guard jalan lagi di hasil LLM juga — re-parse via LLM ga otomatis
    // imun dari salah baca struktur (prompt bisa aja salah paham layout baru).
    const shape = checkShape(rescued, { source: label });
    const { hasFatal, fatal, warn } = splitShapeIssues(shape);
    logShapeWarnings(`${label} (llm fallback)`, warn);
    report.warnIssues.push(...warn);
    if (hasFatal) {
      logShapeFatal(`${label} (llm fallback)`, fatal);
      console.warn(`  ⚠ ${label} (llm fallback) di-SKIP (shape guard): ${fatal.map((f) => f.rule).join(", ")}`);
      report.fatalIssues.push(...fatal.map((f) => ({ ...f, source: f.source || label })));
      report.sources[label] = {
        status: "skipped",
        reason: "shape-fatal-llm-fallback",
        providers: provCount,
        models: modelCount,
        shapeIssues: fatal,
      };
      continue;
    }

    accept(label, rescued, provCount, modelCount);
    report.sources[label] = {
      status: "ok",
      reason: "llm-fallback-rescued",
      providers: provCount,
      models: modelCount,
      shapeIssues: warn,
    };
    report.skipped = report.skipped.filter((l) => l !== label);
  }

  if (partialGroups.length === 0) {
    report.outcome = "aborted-all-sources-failed";
    throw new Error("Semua sumber gagal — ga ada data buat ditulis.");
  }

  // 2. Merge / dedup (gap-fill by priority). Buang provider tanpa model
  //    (card kosong = useless di direktori; mis. entri "gateway" tanpa daftar model).
  const merged = mergeProviders(partialGroups, mergeRunAt);

  // 2c. Authoritative-models rule buat OpenRouter:
  //     OpenRouter punya live API yang ngembaliin daftar model :free SEKARANG —
  //     itu GROUND TRUTH buat dirinya sendiri. Entri model dari sumber komunitas
  //     (mnfst/freellm/cheahjs) bisa STALE: model yang dulu :free tapi udah ilang
  //     dari OpenRouter = info salah. Jadi: kalau adapter openrouter sukses run
  //     ini, daftar model provider "openrouter" yang udah ke-merge di-PANGKAS ke
  //     HANYA model id yang beneran ada di live API (matching keep field gap-fill,
  //     stale di-drop). Kalau adapter openrouter GAGAL run ini (okLabels ga punya),
  //     JANGAN pangkas — biarin last-known-good dari sumber komunitas tetep ada.
  if (okLabels.has(OPENROUTER_LABEL) && openrouterLiveIds && openrouterLiveIds.size > 0) {
    const orProvider = merged.find((p) => p.slug === "openrouter");
    if (orProvider && Array.isArray(orProvider.models)) {
      const before = orProvider.models.length;
      orProvider.models = orProvider.models.filter((m) => openrouterLiveIds.has(m.id));
      orProvider.modelCount = orProvider.models.length;
      const droppedStale = before - orProvider.models.length;
      if (droppedStale > 0) {
        console.log(
          `  · openrouter: ${droppedStale} model komunitas stale di-drop (live API = ground truth)`,
        );
      }
    }
  }

  // Buang provider tanpa model (card kosong = useless).
  const dropped = merged.filter((p) => p.modelCount === 0).map((p) => p.slug);
  const providers = merged.filter((p) => p.modelCount > 0);
  if (dropped.length) console.log(`  · drop ${dropped.length} provider 0-model: ${dropped.join(", ")}`);

  // 2b. Enrich: gap-fill context/maxOutput dari models.dev (best-effort, never
  //     throws). Jalan SEBELUM smoke test biar data yang di-validate = data yang
  //     udah di-enrich. enrichFromModelsDev mutate in-place + return array sama.
  const { enrichedCount } = await enrichFromModelsDev(providers);
  console.log(`  · enrich models.dev: +${enrichedCount} field`);

  // 3. Logo (favicon self-host) + smoke test.
  await downloadLogos(providers);
  smokeTest(providers, report);

  // 3b. Shape guard pada output MERGED final — kali ini di data yang beneran
  //     mau ditulis ke providers.json. Ini axis yang sanity floor + diff guard
  //     (keduanya count-based) GA BISA nangkep: INCIDENT 2026-07-25 (kolom
  //     "Score" freellm kebaca context) lolos count-based guard karena jumlah
  //     baris/kolom TETAP sama. Fatal di sini → ABORT write, last-known-good
  //     tetep live (persis semantik diff-guard di bawah).
  const totalModelsMerged = providers.reduce((a, p) => a + p.modelCount, 0);
  const mergedShape = checkShape(providers, { source: "merged" });
  const { hasFatal: mergedHasFatal, fatal: mergedFatal, warn: mergedWarn } = splitShapeIssues(mergedShape);
  logShapeWarnings("merged", mergedWarn);
  report.warnIssues.push(...mergedWarn);
  report.merged = {
    providers: providers.length,
    models: totalModelsMerged,
    shapeIssues: [...mergedFatal, ...mergedWarn],
  };
  if (mergedHasFatal) {
    logShapeFatal("merged", mergedFatal);
    report.fatalIssues.push(...mergedFatal.map((f) => ({ ...f, source: f.source || "merged" })));
    report.outcome = "aborted-shape-fatal-merged";
    finish(report);
    console.error(
      "✗ Shape guard FAILED pada output merged — kemungkinan korupsi kolom/parse " +
        "(lihat INCIDENT scripts/adapters/freellm.mjs). Last-known-good tetep live, write di-abort.",
    );
    process.exit(1);
  }

  // 3c. Snapshot-diff guard: bandingin vs data lama. Provider hilang / total
  //     model anjlok / 1 provider nyusut drastis → FAIL → push step di CI ga
  //     jalan → last-known-good tetep live. ALLOW_DATA_SHRINK=1 buat override
  //     (mis. sumber emang sengaja ngebuang provider).
  const diff = snapshotDiff(prevProviders, providers, { minProviders: prevProviders.length ? Math.floor(prevProviders.length * 0.8) : null });
  if (diff.warnings.length)
    console.warn("⚠ Snapshot guard:\n" + diff.warnings.join("\n"));
  report.diffGuard = { ok: diff.ok, errors: diff.errors, warnings: diff.warnings, stats: diff.stats };
  if (!diff.ok) {
    if (process.env.ALLOW_DATA_SHRINK === "1") {
      console.warn(
        "⚠ Snapshot guard tripped, ALLOW_DATA_SHRINK=1 → bypass:\n" +
          diff.errors.join("\n"),
      );
      report.diffGuard.bypassed = true;
    } else {
      console.error(
        "✗ Snapshot guard FAILED (data shrink/disappear). Last-known-good tetep live. Set ALLOW_DATA_SHRINK=1 buat force.\n" +
          diff.errors.join("\n"),
      );
      console.error("stats: " + JSON.stringify(diff.stats));
      report.outcome = "aborted-diff-guard";
      finish(report);
      process.exit(1);
    }
  }

  // 4. Tulis output.
  const withLogo = providers.filter((p) => p.logo).length;
  const totalModels = providers.reduce((a, p) => a + p.modelCount, 0);
  const multiSource = providers.filter((p) => p.sources.length > 1).length;
  writeFileSync(OUT, JSON.stringify(providers, null, 2) + "\n");
  console.log(
    `✓ Wrote ${providers.length} providers (${totalModels} models, ${withLogo} logos, ${multiSource} multi-source) → data/providers.json`,
  );

  // 4b. Update rolling baselines (last-known-good) — SETELAH semua guard lulus
  //     (smoke test + snapshot-diff guard) + providers.json ke-tulis. Cuma
  //     source yang LOLOS sanity floor run ini yang dicatat (acceptedCounts).
  //     data/source-baselines.json di-commit bareng providers.json di workflow.
  updateBaselines(acceptedCounts);

  // 5. Prune orphan logos (best-effort — ga boleh ngejatuhin run).
  //    File PNG di LOGO_DIR yang slug-nya ga ada di providers saat ini → delete.
  try {
    const activeSlugSet = new Set(providers.map((p) => p.slug));
    const logoFiles = readdirSync(LOGO_DIR).filter((f) => f.endsWith(".png"));
    let pruned = 0;
    for (const file of logoFiles) {
      const slug = file.slice(0, -4); // strip ".png"
      if (!activeSlugSet.has(slug)) {
        unlinkSync(join(LOGO_DIR, file));
        pruned++;
      }
    }
    if (pruned > 0) console.log(`  · pruned ${pruned} orphan logo(s)`);
  } catch (e) {
    console.warn(`  ⚠ logo prune skipped: ${e.message}`);
  }

  // 6. Changelog: diff prevProviders (snapshot lama, step 0) vs providers final
  //    run ini → append/replace data/changelog.json (fakta diff doang, ga ada
  //    klaim baru). Best-effort — never jatohin pipeline.
  try {
    const diff = computeChangelogDiff(prevProviders, providers);
    if (diff) {
      const result = updateChangelog(diff);
      if (result.wrote) {
        console.log(
          `  · changelog: entry ${result.date} (${diff.providersAdded.length} provider baru, ${diff.providersRemoved.length} provider hilang, ${diff.models.length} provider model berubah)`,
        );
      } else {
        console.warn(`  ⚠ changelog: gagal ditulis (${result.error})`);
      }
    } else {
      console.log("  · changelog: ga ada perubahan, skip entry");
    }
  } catch (e) {
    console.warn(`  ⚠ changelog skipped: ${e.message}`);
  }

  // 7. IndexNow ping — beritahu Bing (feeds Copilot + ChatGPT Search retrieval)
  //    URL yang berubah biar re-crawl ga nunggu jadwal biasa. Best-effort murni
  //    — gagal/timeout cuma warn, ga pernah jatohin pipeline (harmless locally too).
  try {
    const urls = [SITE_URL, ...providers.map((p) => `${SITE_URL}/provider/${p.slug}`)];
    const result = await pingIndexNow(urls);
    console.log(
      `  · IndexNow ping: ${result.ok ? `ok (${result.status})` : `gagal (${result.error || result.status})`}`,
    );
  } catch (e) {
    console.warn(`  ⚠ IndexNow ping skipped: ${e.message}`);
  }

  // 8. Report run ini — sukses ATAU sukses-dengan-warning (source di-skip /
  //    diff-guard bypass / shape-guard warn). Selalu ditulis biar sync-report.json
  //    + job summary ada bahkan pas run mulus (baseline buat compare run
  //    berikutnya, bukan cuma muncul pas gagal).
  report.outcome =
    report.skipped.length > 0 || report.warnIssues.length > 0 || report.diffGuard?.bypassed
      ? "ok-with-warnings"
      : "ok";
  finish(report);
}

// Guard: cuma auto-run main() kalau file ini dieksekusi langsung (`node
// scripts/sync.mjs` / `npm run sync`), BUKAN pas di-import sebagai module.
// Ini yang bikin splitShapeIssues/createSyncReport/writeSyncReport/
// appendJobSummary bisa di-import + di-test standalone (mis. test harness
// yang ngirim synthetic fatal ShapeIssue) TANPA ke-trigger main() yang manggil
// 4 adapter live network.
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    // Exception yang GA lewat salah satu exit point di atas (smoke test /
    // shape guard merged / diff guard — yang udah masing-masing manggil
    // finish() sendiri sebelum exit) → ini crash ga terduga. Tetep tulis
    // report + job summary biar "npm test gagal diam-diam" ga pernah kejadian.
    if (currentReport) {
      if (currentReport.outcome === "running") {
        currentReport.outcome = "crashed";
        currentReport.crash = { message: e?.message || String(e) };
      }
      finish(currentReport);
    }
    process.exit(1);
  });
}
