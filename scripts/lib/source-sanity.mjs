/**
 * Source sanity floors — tokengratis.id pipeline.
 *
 * Problem: if a source's HTML/markdown markup changes, a regex parser can
 * silently return FAR fewer rows than normal (e.g. freellm normally ~170 models,
 * suddenly 5). sync.mjs currently skips a source only when the FETCH fails, not
 * when the fetch succeeds but the PARSE collapses.
 *
 * Exports:
 *   checkSourceFloor(sourceName, providerCount, modelCount) → { ok, message }
 *   updateBaselines(countsBySource)  — tulis data/source-baselines.json
 *
 * Rolling baselines:
 *   - data/source-baselines.json (ditulis sync.mjs setelah semua guard lulus)
 *     adalah "last-known-good" — erosi dibatasi terpisah oleh diff-guard.
 *   - Kalau file belum ada (fresh checkout / CI pertama kali), fallback ke
 *     FALLBACK_BASELINES di bawah — baseline hardcoded dari run 2026-06-03.
 *   - Source baru yang belum punya baseline di manapun: floor check di-SKIP
 *     dengan console warning — baselinenya baru ketulis setelah sync pertama
 *     sukses (via updateBaselines).
 *
 * CATATAN INTEGRATOR (sync.mjs):
 *   Panggil `updateBaselines(countsBySource)` SETELAH semua guard lulus
 *   (smoke test + snapshot-diff guard) — last-known-good semantics.
 *   countsBySource = { [label]: { providers: N, models: N } }
 *   Juga tambahkan `data/source-baselines.json` ke `git add` di workflow nightly.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINES_PATH = join(__dirname, "..", "..", "data", "source-baselines.json");

// ─── Fallback baselines (hardcoded, fresh-checkout safety net) ─────────────────
//
// Diukur dari run live 2026-06-03. Jangan hapus — ini yang jalan kalau
// data/source-baselines.json belum ada (CI fresh checkout, repo baru di-clone).
//
// Floor di-set ~50% dari baseline: cukup longgar untuk fluktuasi komunitas
// normal, cukup ketat untuk nangkap parse collapse.

const FALLBACK_BASELINES = {
  "mnfst/awesome-free-llm-apis": { providers: 24, models: 139 },
  "freellm.net":                  { providers: 27, models: 170 },
  "cheahjs/free-llm-api-resources": { providers: 13, models: 149 },
};

// ─── Load baselines (rolling file > fallback) ──────────────────────────────────

/**
 * Baca data/source-baselines.json kalau ada; merge dengan FALLBACK_BASELINES
 * (file menang untuk source yang overlap). Return map:
 *   { [sourceName]: { providers: N, models: N } }
 *
 * Fungsi ini dipanggil lazy (sekali per proses) karena checkSourceFloor
 * bisa dipanggil berkali-kali dalam satu run.
 */
let _cachedBaselines = null;

function loadBaselines() {
  if (_cachedBaselines !== null) return _cachedBaselines;

  let fileBaselines = {};
  try {
    const raw = readFileSync(BASELINES_PATH, "utf8");
    const parsed = JSON.parse(raw);
    // Shape file: { [sourceName]: { providers, models, updatedAt } }
    // Ambil cuma { providers, models } — updatedAt tidak relevan untuk floor.
    for (const [name, entry] of Object.entries(parsed)) {
      if (
        entry &&
        typeof entry.providers === "number" &&
        typeof entry.models === "number"
      ) {
        fileBaselines[name] = { providers: entry.providers, models: entry.models };
      }
    }
  } catch {
    // File belum ada atau korup → pakai FALLBACK_BASELINES murni.
    fileBaselines = {};
  }

  // Merge: file wins on overlap, fallback covers the rest.
  _cachedBaselines = { ...FALLBACK_BASELINES, ...fileBaselines };
  return _cachedBaselines;
}

// ─── Check function ────────────────────────────────────────────────────────────

/**
 * Cek apakah count adapter memenuhi sanity floor.
 *
 * Floor = ~50% dari baseline yang tersimpan.
 *
 * @param {string} sourceName    - Harus cocok dengan key di baselines / ADAPTERS.label.
 * @param {number} providerCount - Jumlah provider dari adapter.
 * @param {number} modelCount    - Total model dari semua provider.
 * @returns {{ ok: boolean, message: string }}
 *   ok=true  → count oke (atau source baru tanpa baseline → skip floor, beri warning).
 *   ok=false → parse kemungkinan collapse; caller harus skip source ini.
 */
export function checkSourceFloor(sourceName, providerCount, modelCount) {
  const baselines = loadBaselines();
  const baseline = baselines[sourceName];

  if (!baseline) {
    // Source baru — belum ada di file maupun di fallback.
    // Jangan block: baseline akan ketulis setelah sync pertama sukses.
    console.warn(
      `  ⚠ source-sanity: "${sourceName}" belum punya baseline — floor check di-skip. ` +
      `Baseline akan ditulis setelah sync pertama sukses.`,
    );
    return { ok: true, message: "no baseline — floor check skipped (new source)" };
  }

  const minProviders = Math.floor(baseline.providers * 0.5);
  const minModels    = Math.floor(baseline.models    * 0.5);

  if (providerCount < minProviders) {
    return {
      ok: false,
      message:
        `${sourceName}: providerCount ${providerCount} < floor ${minProviders} ` +
        `(baseline ${baseline.providers} → 50% floor; parse collapse suspected — skipping source)`,
    };
  }

  if (modelCount < minModels) {
    return {
      ok: false,
      message:
        `${sourceName}: modelCount ${modelCount} < floor ${minModels} ` +
        `(baseline ${baseline.models} → 50% floor; parse collapse suspected — skipping source)`,
    };
  }

  return {
    ok: true,
    message: `${sourceName}: ${providerCount} providers / ${modelCount} models — OK`,
  };
}

// ─── Update baselines (last-known-good write) ──────────────────────────────────

/**
 * Tulis data/source-baselines.json dengan count sukses terakhir.
 *
 * Dipanggil oleh sync.mjs SETELAH semua guard lulus (smoke test + snapshot-diff).
 * Last-known-good semantics: kalau sync berikutnya parse collapse, file ini
 * masih menyimpan angka yang sehat → floor akan nangkap collapse itu.
 *
 * @param {{ [sourceName: string]: { providers: number, models: number } }} countsBySource
 */
export function updateBaselines(countsBySource) {
  const updatedAt = new Date().toISOString();
  const prev = loadBaselines(); // last-known-good BEFORE this run (cache holds pre-run file)
  const toWrite = {};

  for (const [name, counts] of Object.entries(countsBySource)) {
    if (
      typeof counts.providers === "number" &&
      typeof counts.models    === "number"
    ) {
      // Cap per-run baseline GROWTH. An anomalous over-count (e.g. a parser
      // double-counting rows) must not permanently inflate the floor and make
      // the NEXT normal-sized run fall below it (see docs/log.md INCIDENT
      // 2026-07-17). Capping only ever LOWERS the recorded baseline → strictly
      // safe: it can never block real data, only make the floor more lenient.
      const prevModels = prev[name]?.models;
      const models =
        typeof prevModels === "number" && prevModels > 0
          ? Math.min(counts.models, Math.ceil(prevModels * 1.5))
          : counts.models;
      toWrite[name] = {
        providers: counts.providers,
        models,
        updatedAt,
      };
    }
  }

  // Buat folder data/ kalau belum ada (jarang terjadi tapi aman).
  mkdirSync(join(__dirname, "..", "..", "data"), { recursive: true });
  writeFileSync(BASELINES_PATH, JSON.stringify(toWrite, null, 2) + "\n");
  console.log(`✓ source-baselines.json updated (${Object.keys(toWrite).length} sources)`);

  // Reset cache supaya run berikutnya (dalam proses yang sama, mis. test) pakai nilai baru.
  _cachedBaselines = null;
}

// ─── Self-test ────────────────────────────────────────────────────────────────
//
// Run dengan: node scripts/lib/source-sanity.mjs --selftest
// Exit 1 kalau ada yang gagal.
//
// Harus lulus DENGAN dan TANPA data/source-baselines.json hadir
// (CI jalanin npm test di fresh checkout).

if (process.argv.includes("--selftest")) {
  import("node:assert").then(async ({ default: assert }) => {
    // Delay import os/fs supaya hanya jalan saat selftest.
    const { existsSync, unlinkSync, writeFileSync: wfs } = await import("node:fs");

    let passed = 0;
    let failed = 0;

    function test(description, fn) {
      try {
        fn();
        console.log(`  PASS  ${description}`);
        passed++;
      } catch (err) {
        console.error(`  FAIL  ${description}`);
        console.error(`        ${err.message}`);
        failed++;
      }
    }

    /** Reset modul cache antar path-test (simulasi fresh load). */
    function resetCache() {
      _cachedBaselines = null;
    }

    // Simpan state file asli supaya bisa di-restore setelah test.
    const originalFileExists = existsSync(BASELINES_PATH);
    let originalFileContent = null;
    if (originalFileExists) {
      originalFileContent = readFileSync(BASELINES_PATH, "utf8");
    }

    console.log("source-sanity.mjs self-test");
    console.log("─".repeat(60));

    // ════════════════════════════════════════════════════════════════
    // A. FALLBACK PATH — tanpa data/source-baselines.json
    // ════════════════════════════════════════════════════════════════
    console.log("\n[A] Fallback path (tanpa source-baselines.json)");

    // Hapus file kalau ada biar test ini beneran pakai fallback.
    if (existsSync(BASELINES_PATH)) unlinkSync(BASELINES_PATH);
    resetCache();

    test("A1: mnfst healthy counts pass (fallback)", () => {
      const r = checkSourceFloor("mnfst/awesome-free-llm-apis", 24, 139);
      assert.strictEqual(r.ok, true, `expected ok=true, got: ${r.message}`);
    });

    test("A2: freellm healthy counts pass (fallback)", () => {
      const r = checkSourceFloor("freellm.net", 27, 170);
      assert.strictEqual(r.ok, true, `expected ok=true, got: ${r.message}`);
    });

    test("A3: cheahjs healthy counts pass (fallback)", () => {
      const r = checkSourceFloor("cheahjs/free-llm-api-resources", 13, 149);
      assert.strictEqual(r.ok, true, `expected ok=true, got: ${r.message}`);
    });

    test("A4: freellm collapsed modelCount (5) fails (fallback)", () => {
      const r = checkSourceFloor("freellm.net", 27, 5);
      assert.strictEqual(r.ok, false, `expected ok=false, got: ${r.message}`);
      assert.ok(r.message.includes("modelCount"), `message should mention modelCount: ${r.message}`);
    });

    test("A5: mnfst collapsed modelCount (10) fails (fallback)", () => {
      const r = checkSourceFloor("mnfst/awesome-free-llm-apis", 24, 10);
      assert.strictEqual(r.ok, false, `expected ok=false, got: ${r.message}`);
    });

    test("A6: cheahjs collapsed providerCount (2) fails (fallback)", () => {
      const r = checkSourceFloor("cheahjs/free-llm-api-resources", 2, 149);
      assert.strictEqual(r.ok, false, `expected ok=false, got: ${r.message}`);
      assert.ok(r.message.includes("providerCount"), `message should mention providerCount: ${r.message}`);
    });

    test("A7: freellm exactly at floor passes (fallback, floor=floor(27*0.5)=13 providers / floor(170*0.5)=85 models)", () => {
      const r = checkSourceFloor("freellm.net", 13, 85);
      assert.strictEqual(r.ok, true, `expected ok=true (at floor boundary), got: ${r.message}`);
    });

    test("A8: freellm one below provider floor fails (fallback)", () => {
      const r = checkSourceFloor("freellm.net", 12, 85);
      assert.strictEqual(r.ok, false, `expected ok=false (one below floor), got: ${r.message}`);
    });

    // ════════════════════════════════════════════════════════════════
    // B. UNKNOWN SOURCE — tidak ada di file maupun fallback
    // ════════════════════════════════════════════════════════════════
    console.log("\n[B] Unknown source — no baseline anywhere");

    resetCache();

    test("B1: unknown source passes with skip message", () => {
      const r = checkSourceFloor("some-new-source.example.com", 3, 7);
      assert.strictEqual(r.ok, true, `expected ok=true for unknown source, got: ${r.message}`);
      assert.ok(
        r.message.includes("no baseline"),
        `message should say "no baseline": ${r.message}`,
      );
    });

    test("B2: unknown source with very low counts still passes (floor skipped)", () => {
      const r = checkSourceFloor("brand-new-adapter.io", 1, 1);
      assert.strictEqual(r.ok, true, `expected ok=true (new source, no floor), got: ${r.message}`);
    });

    // ════════════════════════════════════════════════════════════════
    // C. ROLLING PATH — dengan data/source-baselines.json hadir
    // ════════════════════════════════════════════════════════════════
    console.log("\n[C] Rolling path (dengan source-baselines.json)");

    // Tulis file sementara dengan angka LEBIH TINGGI dari fallback
    // → floor ikut naik → angka yang lulus di fallback bisa gagal di rolling.
    const rollingData = {
      "mnfst/awesome-free-llm-apis": { providers: 50, models: 300, updatedAt: new Date().toISOString() },
      "freellm.net":                  { providers: 60, models: 400, updatedAt: new Date().toISOString() },
      "cheahjs/free-llm-api-resources": { providers: 30, models: 350, updatedAt: new Date().toISOString() },
    };

    // Buat folder data/ kalau belum ada di fresh checkout.
    const { mkdirSync: mds } = await import("node:fs");
    mds(join(__dirname, "..", "..", "data"), { recursive: true });
    wfs(BASELINES_PATH, JSON.stringify(rollingData, null, 2) + "\n");
    resetCache();

    test("C1: mnfst healthy (high baseline) passes", () => {
      // floor = floor(50*0.5)=25 providers, floor(300*0.5)=150 models
      const r = checkSourceFloor("mnfst/awesome-free-llm-apis", 30, 160);
      assert.strictEqual(r.ok, true, `expected ok=true, got: ${r.message}`);
    });

    test("C2: mnfst below rolling floor fails (baseline raised)", () => {
      // floor providers = 25; pass 24 providers (was OK vs fallback baseline of 24, now below floor 25)
      const r = checkSourceFloor("mnfst/awesome-free-llm-apis", 24, 160);
      assert.strictEqual(r.ok, false, `expected ok=false (below rolling floor), got: ${r.message}`);
      assert.ok(r.message.includes("providerCount"), `message should mention providerCount: ${r.message}`);
    });

    test("C3: freellm below rolling model floor fails", () => {
      // floor models = floor(400*0.5)=200; pass 139 models (was OK vs fallback)
      const r = checkSourceFloor("freellm.net", 40, 139);
      assert.strictEqual(r.ok, false, `expected ok=false (below rolling floor), got: ${r.message}`);
      assert.ok(r.message.includes("modelCount"), `message should mention modelCount: ${r.message}`);
    });

    test("C4: source not in rolling file falls back to FALLBACK_BASELINES", () => {
      // Tulis rolling file tanpa "freellm.net" → harus fallback ke hardcoded
      const partialRolling = {
        "mnfst/awesome-free-llm-apis": { providers: 50, models: 300, updatedAt: new Date().toISOString() },
      };
      wfs(BASELINES_PATH, JSON.stringify(partialRolling, null, 2) + "\n");
      resetCache();
      // freellm.net fallback baseline: providers=27, models=170 → floor=13/85
      const r = checkSourceFloor("freellm.net", 14, 86);
      assert.strictEqual(r.ok, true, `expected ok=true (fallback used), got: ${r.message}`);
    });

    test("C5: unknown source with rolling file present still passes (skip with warning)", () => {
      resetCache();
      const r = checkSourceFloor("totally-new-source.ai", 5, 20);
      assert.strictEqual(r.ok, true, `expected ok=true (unknown source skip), got: ${r.message}`);
    });

    // ════════════════════════════════════════════════════════════════
    // D. updateBaselines — round-trip write + read
    // ════════════════════════════════════════════════════════════════
    console.log("\n[D] updateBaselines round-trip");

    test("D1: updateBaselines tulis file dan reset cache", () => {
      updateBaselines({
        "mnfst/awesome-free-llm-apis":    { providers: 30, models: 200 },
        "freellm.net":                    { providers: 35, models: 220 },
        "cheahjs/free-llm-api-resources": { providers: 18, models: 180 },
      });
      // Cache sudah direset oleh updateBaselines — loadBaselines() akan re-baca file.
      // Cek checkSourceFloor pakai angka baru.
      // floor mnfst providers = floor(30*0.5) = 15; kirim 15 → harus pass
      const r = checkSourceFloor("mnfst/awesome-free-llm-apis", 15, 100);
      assert.strictEqual(r.ok, true, `expected ok=true after updateBaselines, got: ${r.message}`);
    });

    test("D2: setelah updateBaselines, angka di bawah floor baru gagal", () => {
      // floor mnfst providers = floor(30*0.5) = 15; kirim 14 → harus fail
      const r = checkSourceFloor("mnfst/awesome-free-llm-apis", 14, 100);
      assert.strictEqual(r.ok, false, `expected ok=false after updateBaselines, got: ${r.message}`);
    });

    test("D3: updateBaselines dengan entry tidak valid di-skip", () => {
      // Ini harus ga throw — invalid entry diabaikan
      updateBaselines({
        "good-source": { providers: 10, models: 50 },
        "bad-source":  { providers: "not-a-number", models: null },
      });
      // Cek hanya good-source yang masuk
      resetCache();
      const r = checkSourceFloor("good-source", 5, 25);
      assert.strictEqual(r.ok, true, `expected ok=true for good-source, got: ${r.message}`);
    });

    // ════════════════════════════════════════════════════════════════
    // Restore state
    // ════════════════════════════════════════════════════════════════
    resetCache();
    if (originalFileExists) {
      wfs(BASELINES_PATH, originalFileContent);
    } else {
      // File ga ada sebelum test → hapus file yang kita tulis.
      if (existsSync(BASELINES_PATH)) unlinkSync(BASELINES_PATH);
    }
    resetCache();

    // ─── Summary ────────────────────────────────────────────────────
    console.log("\n" + "─".repeat(60));
    console.log(`${passed} passed, ${failed} failed`);

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log("All tests passed.");
    }
  });
}
