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
//
// Anti-halusinasi: tiap adapter cuma mindahin field yang EKSPLISIT ada di
// sumbernya. Merge = gap-fill by priority (scripts/lib/merge.mjs). Ga nebak.

import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { fetchProviders as fetchMnfst } from "./adapters/mnfst.mjs";
import { fetchProviders as fetchFreellm } from "./adapters/freellm.mjs";
import { fetchProviders as fetchCheahjs } from "./adapters/cheahjs.mjs";
import { mergeProviders } from "./lib/merge.mjs";
import { snapshotDiff } from "./lib/diff-guard.mjs";
import { checkSourceFloor } from "./lib/source-sanity.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "providers.json");
const LOGO_DIR = join(__dirname, "..", "public", "logos");

// Tiap adapter: { label, fn }. Adapter yang gagal fetch ga boleh ngejatuhin
// seluruh pipeline — di-skip dengan warning (sumber lain tetep jalan).
const ADAPTERS = [
  { label: "mnfst/awesome-free-llm-apis", fn: fetchMnfst },
  { label: "freellm.net", fn: fetchFreellm },
  { label: "cheahjs/free-llm-api-resources", fn: fetchCheahjs },
];

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
  const settled = await Promise.allSettled(ADAPTERS.map((a) => a.fn()));
  const partialGroups = [];
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
        return;
      }
      console.log(`  ✓ ${label}: ${provCount} provider, ${modelCount} model`);
      partialGroups.push(res.value);
    } else {
      const reason = res.status === "rejected" ? res.reason : "bukan array";
      console.warn(`  ⚠ ${label} di-SKIP: ${reason?.message || reason}`);
    }
  });

  if (partialGroups.length === 0) {
    throw new Error("Semua sumber gagal — ga ada data buat ditulis.");
  }

  // 2. Merge / dedup (gap-fill by priority). Buang provider tanpa model
  //    (card kosong = useless di direktori; mis. entri "gateway" tanpa daftar model).
  const merged = mergeProviders(partialGroups, mergeRunAt);
  const dropped = merged.filter((p) => p.modelCount === 0).map((p) => p.slug);
  const providers = merged.filter((p) => p.modelCount > 0);
  if (dropped.length) console.log(`  · drop ${dropped.length} provider 0-model: ${dropped.join(", ")}`);

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
