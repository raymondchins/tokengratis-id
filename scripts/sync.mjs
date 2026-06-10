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
// Anti-halusinasi: tiap adapter cuma mindahin field yang EKSPLISIT ada di
// sumbernya. Merge = gap-fill by priority (scripts/lib/merge.mjs). Ga nebak.

import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "providers.json");
const LOGO_DIR = join(__dirname, "..", "public", "logos");

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
    const res = await fetch(reg.url, { signal: AbortSignal.timeout(20_000) });
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
  const provCount = partials.length;
  const modelCount = partials.reduce((a, p) => a + (p.models?.length || 0), 0);
  const floor = checkSourceFloor(label, provCount, modelCount);
  if (!floor.ok) {
    console.warn(`  ⚠ LLM fallback ${label} masih di bawah sanity floor: ${floor.message} — skip.`);
    return null;
  }

  console.log(`  ✓ LLM fallback rescued ${label}: ${provCount} provider, ${modelCount} model`);
  return partials;
}

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
        const r = await fetch(
          `https://www.google.com/s2/favicons?sz=128&domain=${p.domain}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!r.ok) throw new Error(String(r.status));
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 100) throw new Error("empty favicon");
        writeFileSync(join(LOGO_DIR, `${p.slug}.png`), buf);
        p.logo = `/logos/${p.slug}.png`;
      } catch {
        p.logo = null;
      }
    }),
  );
}

/** Smoke test (PRD): tiap entry wajib punya source+syncedAt, ga ada sentinel nyangkut. */
function smokeTest(providers) {
  const errs = [];
  const warns = [];

  // Valid category values (null = not sourced, which is fine for cheahjs/freellm-only providers)
  const VALID_CATEGORIES = new Set(["provider_api", "inference_provider", null]);

  // Meta-row pattern: generic descriptor ending in "models" with no version/id signal.
  // Mirrors GENERIC_MODELS_PATTERN in cheahjs.mjs — catches fake models that slip through merge.
  const META_MODEL_PATTERN = /\bmodels\s*$/i;

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
          (META_MODEL_PATTERN.test(m.id || "") && !/[\d\-\/]/.test(m.id || "")) ||
          (META_MODEL_PATTERN.test(m.name || "") && !/[\d\-\/]/.test(m.name || ""));
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

  if (warns.length) {
    console.warn("⚠ Smoke test warnings:\n" + warns.join("\n"));
  }
  if (errs.length) {
    console.error("✗ Smoke test FAILED:\n" + errs.join("\n"));
    process.exit(1);
  }
  console.log("✓ Smoke test passed");
}

async function main() {
  const mergeRunAt = new Date().toISOString();

  // 0. Baca snapshot lama (data/providers.json yang udah ke-commit) buat
  //    snapshot-diff guard di langkah 4. First run / file korup → [] (guard skip).
  let prevProviders = [];
  try {
    if (existsSync(OUT)) prevProviders = JSON.parse(readFileSync(OUT, "utf8"));
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
      const provCount = res.value.length;
      const modelCount = res.value.reduce((a, p) => a + (p.models?.length || 0), 0);
      // Sanity floor: fetch sukses tapi parse jeblok (markup sumber berubah →
      // regex cuma dapet sedikit row) → skip sumber ini, jangan korup merge.
      // Sumber lain + last-good gap-fill tetep jalan.
      const floor = checkSourceFloor(label, provCount, modelCount);
      if (!floor.ok) {
        console.warn(`  ⚠ ${label} di-SKIP (sanity floor): ${floor.message}`);
        if (SOURCE_REGISTRY[label] && hasLlmKey) fallbackCandidates.push(label);
        return;
      }
      accept(label, res.value, provCount, modelCount);
    } else {
      const reason = res.status === "rejected" ? res.reason : "bukan array";
      console.warn(`  ⚠ ${label} di-SKIP: ${reason?.message || reason}`);
      if (SOURCE_REGISTRY[label] && hasLlmKey) fallbackCandidates.push(label);
    }
  });

  // 1b. LLM fallback buat sumber unstructured yang gagal — re-fetch + re-parse
  //     via Claude Haiku, lalu re-cek sanity floor. Lolos → masuk merge sama
  //     kayak adapter biasa. Cuma jalan kalau ANTHROPIC_API_KEY ada (di-cek
  //     waktu ngumpulin fallbackCandidates).
  for (const label of fallbackCandidates) {
    const rescued = await tryLlmFallback(label);
    if (rescued) {
      const provCount = rescued.length;
      const modelCount = rescued.reduce((a, p) => a + (p.models?.length || 0), 0);
      accept(label, rescued, provCount, modelCount);
    }
  }

  if (partialGroups.length === 0) {
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
  smokeTest(providers);

  // 3b. Snapshot-diff guard: bandingin vs data lama. Provider hilang / total
  //     model anjlok / 1 provider nyusut drastis → FAIL → push step di CI ga
  //     jalan → last-known-good tetep live. ALLOW_DATA_SHRINK=1 buat override
  //     (mis. sumber emang sengaja ngebuang provider).
  const diff = snapshotDiff(prevProviders, providers, { minProviders: prevProviders.length ? Math.floor(prevProviders.length * 0.8) : null });
  if (diff.warnings.length)
    console.warn("⚠ Snapshot guard:\n" + diff.warnings.join("\n"));
  if (!diff.ok) {
    if (process.env.ALLOW_DATA_SHRINK === "1") {
      console.warn(
        "⚠ Snapshot guard tripped, ALLOW_DATA_SHRINK=1 → bypass:\n" +
          diff.errors.join("\n"),
      );
    } else {
      console.error(
        "✗ Snapshot guard FAILED (data shrink/disappear). Last-known-good tetep live. Set ALLOW_DATA_SHRINK=1 buat force.\n" +
          diff.errors.join("\n"),
      );
      console.error("stats: " + JSON.stringify(diff.stats));
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
