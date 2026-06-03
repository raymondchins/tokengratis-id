// Diff-guard: detects silent data loss between pipeline runs.
// Catches disappeared providers and model-count collapses before
// bad data can be committed to prod (last-known-good stays live).
//
// Pure function — no file I/O. Call from sync.mjs after smoke test.
//
//   import { snapshotDiff } from "./lib/diff-guard.mjs";
//   const result = snapshotDiff(prev, next, { maxTotalDropPct: 15 });
//   if (!result.ok) { console.error(result.errors); process.exit(1); }

/**
 * Count models for a provider object.
 * Prefers models[].length (truth), falls back to modelCount (summary field).
 * @param {object} p
 * @returns {number}
 */
function modelCount(p) {
  return p.models?.length ?? p.modelCount ?? 0;
}

/**
 * Detect silent data loss between two pipeline runs.
 *
 * @param {object[]|null|undefined} prev  Previous providers.json array (or null/[] on first run).
 * @param {object[]}               next  Newly-generated providers array.
 * @param {object}                 opts
 * @param {number}  [opts.maxTotalDropPct=15]    Error if total model count drops > this %.
 * @param {number}  [opts.maxProviderDropPct=40] Error if any single provider's model count drops > this %
 *                                               (only when prev had >= 3 models).
 * @param {number|null} [opts.minProviders=null] Error if next has fewer providers than this.
 *
 * @returns {{
 *   ok: boolean,
 *   errors: string[],
 *   warnings: string[],
 *   stats: {
 *     prevProviders: number,
 *     nextProviders: number,
 *     prevModels: number,
 *     nextModels: number,
 *     totalDropPct: number|null,
 *     disappeared: string[],
 *     shrunk: Array<{slug: string, prev: number, next: number, dropPct: number}>
 *   }
 * }}
 */
export function snapshotDiff(prev, next, opts = {}) {
  const {
    maxTotalDropPct = 15,
    maxProviderDropPct = 40,
    minProviders = null,
  } = opts;

  const errors = [];
  const warnings = [];

  // ── First run / empty prev ────────────────────────────────────────────────
  if (!prev || prev.length === 0) {
    const nextModels = Array.isArray(next)
      ? next.reduce((a, p) => a + modelCount(p), 0)
      : 0;
    return {
      ok: true,
      errors: [],
      warnings: ["no previous snapshot — guard skipped"],
      stats: {
        prevProviders: 0,
        nextProviders: Array.isArray(next) ? next.length : 0,
        prevModels: 0,
        nextModels,
        totalDropPct: null,
        disappeared: [],
        shrunk: [],
      },
    };
  }

  // ── Build lookup maps (by slug) ───────────────────────────────────────────
  /** @type {Map<string, number>} slug → model count */
  const prevMap = new Map(prev.map((p) => [p.slug, modelCount(p)]));
  /** @type {Map<string, number>} */
  const nextMap = new Map(next.map((p) => [p.slug, modelCount(p)]));

  // ── Stats ─────────────────────────────────────────────────────────────────
  const prevModels = [...prevMap.values()].reduce((a, n) => a + n, 0);
  const nextModels = [...nextMap.values()].reduce((a, n) => a + n, 0);
  const totalDropPct =
    prevModels > 0 ? ((prevModels - nextModels) / prevModels) * 100 : null;

  // Disappeared providers
  const disappeared = [];
  for (const slug of prevMap.keys()) {
    if (!nextMap.has(slug)) disappeared.push(slug);
  }

  // Per-provider shrink (prev had >= 3 models to avoid noise on tiny providers)
  const shrunk = [];
  for (const [slug, prevCount] of prevMap.entries()) {
    if (!nextMap.has(slug)) continue; // already in disappeared
    const nextCount = nextMap.get(slug);
    if (prevCount < 3) continue; // too small — skip noise
    const dropPct = ((prevCount - nextCount) / prevCount) * 100;
    if (dropPct > maxProviderDropPct) {
      shrunk.push({ slug, prev: prevCount, next: nextCount, dropPct });
    }
  }

  // ── Rule 1: disappeared providers ────────────────────────────────────────
  for (const slug of disappeared) {
    errors.push(
      `provider "${slug}" disappeared (was in prev, missing in next)`,
    );
  }

  // ── Rule 2: total model count drop ───────────────────────────────────────
  if (totalDropPct !== null && totalDropPct > maxTotalDropPct) {
    errors.push(
      `total model count dropped ${totalDropPct.toFixed(1)}% ` +
        `(${prevModels} → ${nextModels}), threshold is ${maxTotalDropPct}%`,
    );
  }

  // ── Rule 3: per-provider model count drop ─────────────────────────────────
  for (const s of shrunk) {
    errors.push(
      `provider "${s.slug}" model count dropped ${s.dropPct.toFixed(1)}% ` +
        `(${s.prev} → ${s.next}), threshold is ${maxProviderDropPct}%`,
    );
  }

  // ── Rule 4: minProviders floor ────────────────────────────────────────────
  if (minProviders !== null && next.length < minProviders) {
    errors.push(
      `next has ${next.length} providers, below minProviders floor of ${minProviders}`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      prevProviders: prev.length,
      nextProviders: next.length,
      prevModels,
      nextModels,
      totalDropPct,
      disappeared,
      shrunk,
    },
  };
}

// ── Self-test (node scripts/lib/diff-guard.mjs --selftest) ───────────────────
if (process.argv.includes("--selftest")) {
  import("node:assert").then(({ default: assert }) => {
    let passed = 0;
    let failed = 0;

    function run(label, fn) {
      try {
        fn();
        console.log(`  PASS  ${label}`);
        passed++;
      } catch (e) {
        console.error(`  FAIL  ${label}`);
        console.error(`        ${e.message}`);
        failed++;
      }
    }

    // Helpers
    const makeProvider = (slug, models) => ({
      slug,
      name: slug,
      models: models.map((id) => ({ id, name: id, context: null, maxOutput: null, modality: null, rateLimit: null })),
      modelCount: models.length,
      syncedAt: new Date().toISOString(),
      sourceUpdatedAt: null,
    });

    console.log("\nRunning diff-guard self-tests...\n");

    // ── (a) Normal small delta → ok=true ─────────────────────────────────────
    run("(a) normal small delta passes ok=true", () => {
      const prev = [
        makeProvider("openrouter", ["m1", "m2", "m3", "m4", "m5"]),
        makeProvider("together", ["m1", "m2", "m3"]),
        makeProvider("groq", ["m1", "m2", "m3", "m4"]),
      ];
      // next: one model added, one removed from openrouter (net ~0), same others
      const next = [
        makeProvider("openrouter", ["m1", "m2", "m3", "m4", "m6"]), // 5 → 5
        makeProvider("together", ["m1", "m2", "m3"]),                // unchanged
        makeProvider("groq", ["m1", "m2", "m3", "m4"]),              // unchanged
      ];
      const result = snapshotDiff(prev, next);
      assert.strictEqual(result.ok, true, `ok should be true, errors: ${result.errors.join("; ")}`);
      assert.strictEqual(result.errors.length, 0, "no errors expected");
    });

    // ── (b) Provider disappears → ok=false ───────────────────────────────────
    run("(b) disappeared provider → ok=false", () => {
      const prev = [
        makeProvider("openrouter", ["m1", "m2", "m3"]),
        makeProvider("together", ["m1", "m2"]),
      ];
      const next = [
        makeProvider("openrouter", ["m1", "m2", "m3"]),
        // "together" is gone
      ];
      const result = snapshotDiff(prev, next);
      assert.strictEqual(result.ok, false, "ok should be false");
      assert.ok(
        result.errors.some((e) => e.includes("together") && e.includes("disappeared")),
        `expected disappeared error for "together", got: ${result.errors.join("; ")}`,
      );
      assert.ok(
        result.stats.disappeared.includes("together"),
        "disappeared array should include 'together'",
      );
    });

    // ── (c) 50% total model count drop → ok=false ────────────────────────────
    run("(c) 50% total model drop → ok=false", () => {
      const prev = [
        makeProvider("openrouter", ["m1", "m2", "m3", "m4", "m5", "m6"]),
        makeProvider("together", ["m1", "m2", "m3", "m4"]),
      ];
      // Total prev = 10, next = 5 (50% drop)
      const next = [
        makeProvider("openrouter", ["m1", "m2", "m3"]),  // 6→3
        makeProvider("together", ["m1", "m2"]),           // 4→2
      ];
      const result = snapshotDiff(prev, next, { maxTotalDropPct: 15, maxProviderDropPct: 40 });
      assert.strictEqual(result.ok, false, "ok should be false");
      assert.ok(
        result.errors.some((e) => e.includes("total model count dropped")),
        `expected total-drop error, got: ${result.errors.join("; ")}`,
      );
      assert.ok(
        result.stats.totalDropPct !== null && result.stats.totalDropPct > 40,
        `totalDropPct should be > 40, got ${result.stats.totalDropPct}`,
      );
    });

    // ── (d) Empty prev → ok=true, warning "guard skipped" ───────────────────
    run("(d) empty prev → ok=true with guard-skipped warning", () => {
      const next = [makeProvider("openrouter", ["m1", "m2"])];

      // null prev
      const r1 = snapshotDiff(null, next);
      assert.strictEqual(r1.ok, true, "null prev: ok should be true");
      assert.ok(
        r1.warnings.some((w) => w.includes("guard skipped")),
        `null prev: expected guard-skipped warning, got: ${r1.warnings.join("; ")}`,
      );

      // [] prev
      const r2 = snapshotDiff([], next);
      assert.strictEqual(r2.ok, true, "[] prev: ok should be true");
      assert.ok(
        r2.warnings.some((w) => w.includes("guard skipped")),
        `[] prev: expected guard-skipped warning, got: ${r2.warnings.join("; ")}`,
      );

      // undefined prev
      const r3 = snapshotDiff(undefined, next);
      assert.strictEqual(r3.ok, true, "undefined prev: ok should be true");
    });

    console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
  });
}
