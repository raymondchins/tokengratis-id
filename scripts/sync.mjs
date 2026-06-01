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

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { fetchProviders as fetchMnfst } from "./adapters/mnfst.mjs";
import { fetchProviders as fetchFreellm } from "./adapters/freellm.mjs";
import { fetchProviders as fetchCheahjs } from "./adapters/cheahjs.mjs";
import { mergeProviders } from "./lib/merge.mjs";

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
  for (const p of providers) {
    if (!p.sources || p.sources.length === 0 || !p.syncedAt)
      errs.push(`${p.slug}: missing sources/syncedAt`);
    if (p.sources?.some((s) => !s.name || !s.url || !s.syncedAt))
      errs.push(`${p.slug}: source ref tidak lengkap`);
    if (p.modelCount === 0 && p.maxContext)
      errs.push(`${p.slug}: 0 models tapi maxContext keisi`);
    if (p.maxContext === "—" || p.maxContext === "-")
      errs.push(`${p.slug}: maxContext sentinel`);
    if (!p.slug || !p.name) errs.push(`${p.slug || "?"}: slug/name kosong`);
  }
  if (errs.length) {
    console.error("✗ Smoke test FAILED:\n" + errs.join("\n"));
    process.exit(1);
  }
  console.log("✓ Smoke test passed");
}

async function main() {
  const mergeRunAt = new Date().toISOString();

  // 1. Fetch semua sumber paralel. Sumber gagal → skip (jangan jatohin pipeline).
  const settled = await Promise.allSettled(ADAPTERS.map((a) => a.fn()));
  const partialGroups = [];
  settled.forEach((res, i) => {
    const label = ADAPTERS[i].label;
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      console.log(
        `  ✓ ${label}: ${res.value.length} provider, ${res.value.reduce((a, p) => a + (p.models?.length || 0), 0)} model`,
      );
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

  // 4. Tulis output.
  const withLogo = providers.filter((p) => p.logo).length;
  const totalModels = providers.reduce((a, p) => a + p.modelCount, 0);
  const multiSource = providers.filter((p) => p.sources.length > 1).length;
  writeFileSync(OUT, JSON.stringify(providers, null, 2) + "\n");
  console.log(
    `✓ Wrote ${providers.length} providers (${totalModels} models, ${withLogo} logos, ${multiSource} multi-source) → data/providers.json`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
