/**
 * Source sanity floors — tokengratis.id pipeline.
 *
 * Problem: if a source's HTML/markdown markup changes, a regex parser can
 * silently return FAR fewer rows than normal (e.g. freellm normally ~170 models,
 * suddenly 5). sync.mjs currently skips a source only when the FETCH fails, not
 * when the fetch succeeds but the PARSE collapses.
 *
 * This module exports:
 *   SOURCE_FLOORS  — per-source minimum counts (set at ~50% of healthy baseline)
 *   checkSourceFloor(sourceName, providerCount, modelCount) → { ok, message }
 *
 * Pure functions, no I/O. Source names MUST match the `label` strings in
 * sync.mjs's ADAPTERS array exactly.
 */

// ─── Floors ───────────────────────────────────────────────────────────────────
//
// Healthy baseline (live run 2026-06-03):
//   mnfst/awesome-free-llm-apis   → 24 providers / 139 models
//   freellm.net                   → 27 providers / 170 models
//   cheahjs/free-llm-api-resources → 13 providers / 149 models
//
// Floors set at ~50% of baseline — generous enough that normal community
// fluctuation never trips them, but tight enough to catch a parse collapse.

export const SOURCE_FLOORS = {
  "mnfst/awesome-free-llm-apis": {
    minProviders: 12, // baseline 24 → floor 50%
    minModels: 70,    // baseline 139 → floor ~50%
  },
  "freellm.net": {
    minProviders: 14, // baseline 27 → floor ~50%
    minModels: 85,    // baseline 170 → floor 50%
  },
  "cheahjs/free-llm-api-resources": {
    minProviders: 7,  // baseline 13 → floor ~54%
    minModels: 75,    // baseline 149 → floor ~50%
  },
};

// ─── Check function ────────────────────────────────────────────────────────────

/**
 * Check whether a source's parsed counts meet the sanity floor.
 *
 * @param {string} sourceName    - Must match a key in SOURCE_FLOORS exactly.
 * @param {number} providerCount - Number of providers returned by the adapter.
 * @param {number} modelCount    - Total models across all providers.
 * @returns {{ ok: boolean, message: string }}
 *   ok=true  → counts are fine (or source is unknown → no floor configured).
 *   ok=false → parse likely collapsed; caller should skip this source.
 */
export function checkSourceFloor(sourceName, providerCount, modelCount) {
  const floor = SOURCE_FLOORS[sourceName];

  if (!floor) {
    return { ok: true, message: "no floor configured" };
  }

  if (providerCount < floor.minProviders) {
    return {
      ok: false,
      message:
        `${sourceName}: providerCount ${providerCount} < floor ${floor.minProviders} ` +
        `(parse collapse suspected — skipping source)`,
    };
  }

  if (modelCount < floor.minModels) {
    return {
      ok: false,
      message:
        `${sourceName}: modelCount ${modelCount} < floor ${floor.minModels} ` +
        `(parse collapse suspected — skipping source)`,
    };
  }

  return {
    ok: true,
    message: `${sourceName}: ${providerCount} providers / ${modelCount} models — OK`,
  };
}

// ─── Self-test ────────────────────────────────────────────────────────────────
//
// Run with: node scripts/lib/source-sanity.mjs --selftest
// Exits 1 on any failure.

if (process.argv.includes("--selftest")) {
  import("node:assert").then(({ default: assert }) => {
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

    console.log("source-sanity.mjs self-test");
    console.log("─".repeat(50));

    // ── Healthy counts pass ───────────────────────────────────────────────────

    test("mnfst healthy counts pass", () => {
      const r = checkSourceFloor("mnfst/awesome-free-llm-apis", 24, 139);
      assert.strictEqual(r.ok, true, `expected ok=true, got: ${r.message}`);
    });

    test("freellm healthy counts pass", () => {
      const r = checkSourceFloor("freellm.net", 27, 170);
      assert.strictEqual(r.ok, true, `expected ok=true, got: ${r.message}`);
    });

    test("cheahjs healthy counts pass", () => {
      const r = checkSourceFloor("cheahjs/free-llm-api-resources", 13, 149);
      assert.strictEqual(r.ok, true, `expected ok=true, got: ${r.message}`);
    });

    // ── Collapsed model count fails ───────────────────────────────────────────

    test("freellm collapsed modelCount (5) fails", () => {
      const r = checkSourceFloor("freellm.net", 27, 5);
      assert.strictEqual(r.ok, false, `expected ok=false, got: ${r.message}`);
      assert.ok(
        r.message.includes("modelCount"),
        `message should mention modelCount: ${r.message}`,
      );
    });

    test("mnfst collapsed modelCount (10) fails", () => {
      const r = checkSourceFloor("mnfst/awesome-free-llm-apis", 24, 10);
      assert.strictEqual(r.ok, false, `expected ok=false, got: ${r.message}`);
    });

    test("cheahjs collapsed providerCount (2) fails", () => {
      const r = checkSourceFloor("cheahjs/free-llm-api-resources", 2, 149);
      assert.strictEqual(r.ok, false, `expected ok=false, got: ${r.message}`);
      assert.ok(
        r.message.includes("providerCount"),
        `message should mention providerCount: ${r.message}`,
      );
    });

    // ── Both counts at floor boundary ─────────────────────────────────────────

    test("freellm exactly at floor passes", () => {
      const r = checkSourceFloor("freellm.net", 14, 85);
      assert.strictEqual(r.ok, true, `expected ok=true (at floor boundary), got: ${r.message}`);
    });

    test("freellm one below floor on providers fails", () => {
      const r = checkSourceFloor("freellm.net", 13, 85);
      assert.strictEqual(r.ok, false, `expected ok=false (one below floor), got: ${r.message}`);
    });

    // ── Unknown source passes ─────────────────────────────────────────────────

    test("unknown source passes (no floor configured)", () => {
      const r = checkSourceFloor("some-new-source.example.com", 3, 7);
      assert.strictEqual(r.ok, true, `expected ok=true for unknown source, got: ${r.message}`);
      assert.strictEqual(
        r.message,
        "no floor configured",
        `expected "no floor configured", got: ${r.message}`,
      );
    });

    // ── Summary ───────────────────────────────────────────────────────────────

    console.log("─".repeat(50));
    console.log(`${passed} passed, ${failed} failed`);

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log("All tests passed.");
    }
  });
}
