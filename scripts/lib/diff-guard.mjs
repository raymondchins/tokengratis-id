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
 * @param {number}  [opts.maxIdChurnPct=50]      Error if a provider's model ids churn > this %
 *                                               (overlap of prev∩next id sets too low — catches
 *                                               same-count garbage swaps; only when prev had >= 3 ids).
 * @param {number|null} [opts.minProviders=null] Error if next has fewer providers than this.
 * @param {number}  [opts.maxDisappeared=1]      Tolerate up to this many disappeared providers WHEN the
 *                                               catalog otherwise grows (provider count not shrinking AND
 *                                               total model count within maxTotalDropPct) — normal upstream
 *                                               churn (a provider renamed/removed, others added). Above this,
 *                                               or alongside any net shrink, disappearance stays a hard error.
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
 *     shrunk: Array<{slug: string, prev: number, next: number, dropPct: number}>,
 *     churned: Array<{slug: string, overlapPct: number, prevIds: number, nextIds: number}>
 *   }
 * }}
 */
export function snapshotDiff(prev, next, opts = {}) {
  const {
    maxTotalDropPct = 15,
    maxProviderDropPct = 40,
    maxIdChurnPct = 50,
    minProviders = null,
    maxDisappeared = 1,
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
        churned: [],
      },
    };
  }

  // ── Build lookup maps (by slug) ───────────────────────────────────────────
  /** @type {Map<string, number>} slug → model count */
  const prevMap = new Map(prev.map((p) => [p.slug, modelCount(p)]));
  /** @type {Map<string, number>} */
  const nextMap = new Map(next.map((p) => [p.slug, modelCount(p)]));

  // Id sets (by slug) — needed for identity-aware churn detection. Counts alone
  // can't catch a same-count garbage swap (every model id replaced at equal size).
  /** @type {Map<string, Set<string>>} slug → set of model ids */
  const prevIdMap = new Map(
    prev.map((p) => [p.slug, new Set((p.models ?? []).map((m) => m.id).filter(Boolean))]),
  );
  /** @type {Map<string, Set<string>>} */
  const nextIdMap = new Map(
    next.map((p) => [p.slug, new Set((p.models ?? []).map((m) => m.id).filter(Boolean))]),
  );

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

  // Per-provider id churn (prev had >= 3 ids). Overlap = |prev ∩ next| / |prev|.
  // Low overlap at a similar count = ids wholesale replaced (likely source corruption,
  // e.g. a column-shift turning every model id into a date string).
  const churned = [];
  const minOverlap = 1 - maxIdChurnPct / 100;
  for (const [slug, prevIds] of prevIdMap.entries()) {
    if (!nextIdMap.has(slug)) continue; // already in disappeared
    if (prevIds.size < 3) continue; // too small — skip noise
    const nextIds = nextIdMap.get(slug);
    let kept = 0;
    for (const id of prevIds) {
      if (nextIds.has(id)) kept++;
    }
    const overlap = kept / prevIds.size;
    if (overlap < minOverlap) {
      churned.push({ slug, overlapPct: overlap * 100, prevIds: prevIds.size, nextIds: nextIds.size });
    }
  }

  // ── Rule 1: disappeared providers ────────────────────────────────────────
  // A small number of providers vanishing while the catalog OVERALL grows
  // (provider count not shrinking AND total model count within maxTotalDropPct)
  // is normal upstream churn — a provider gets renamed/removed at the source
  // while others are added (e.g. mistral-codestral dropped, net 26→27 providers).
  // Demote that to a warning so the nightly run still ships. Mass disappearance
  // (> maxDisappeared), or ANY disappearance alongside a net provider/model
  // shrink, stays a hard error. The minProviders floor (Rule 4) independently
  // backstops mass loss.
  const totalModelsWithinBound =
    totalDropPct === null || totalDropPct <= maxTotalDropPct;
  const disappearanceIsBenignChurn =
    disappeared.length > 0 &&
    disappeared.length <= maxDisappeared &&
    next.length >= prev.length &&
    totalModelsWithinBound;

  if (disappearanceIsBenignChurn) {
    warnings.push(
      `provider${disappeared.length > 1 ? "s" : ""} ` +
        `${disappeared.map((s) => `"${s}"`).join(", ")} disappeared, but catalog grew ` +
        `(${prev.length}→${next.length} providers, ${prevModels}→${nextModels} models) — ` +
        `treating as normal upstream churn`,
    );
  } else {
    for (const slug of disappeared) {
      errors.push(
        `provider "${slug}" disappeared (was in prev, missing in next)`,
      );
    }
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

  // ── Rule 5: per-provider model id churn (same-count garbage swap) ─────────
  // A genuine garbage swap (e.g. a column-shift turning every id into a date
  // string) replaces ids WITHOUT net growth and usually hits several providers
  // at once. A FEW providers rotating their ids while the catalog OVERALL grows
  // (no disappearance, no per-provider shrink, more models than before) is normal
  // upstream churn — some sources rotate their model catalog constantly
  // (e.g. NVIDIA NIM churning nemotron versions). Demote that to a warning so the
  // nightly run still ships; keep it a hard error when churn co-occurs with any
  // shrink/disappearance or when many providers churn at once (corruption signature).
  const churnIsBenign =
    churned.length > 0 &&
    churned.length <= maxDisappeared &&
    disappeared.length === 0 &&
    shrunk.length === 0 &&
    next.length >= prev.length &&
    nextModels > prevModels;

  for (const c of churned) {
    const msg =
      `provider "${c.slug}" model ids churned ${(100 - c.overlapPct).toFixed(1)}% ` +
      `at same-ish count (overlap ${c.overlapPct.toFixed(1)}%, ${c.prevIds}→${c.nextIds} ids)`;
    if (churnIsBenign) {
      warnings.push(
        `${msg}, but catalog grew (${prev.length}→${next.length} providers, ` +
          `${prevModels}→${nextModels} models) — treating as normal upstream churn`,
      );
    } else {
      errors.push(`${msg} — possible source corruption`);
    }
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
      churned,
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

    // ── (e) Same-count garbage swap (ids wholesale replaced) → ok=false ──────
    run("(e) same-count id churn → ok=false", () => {
      const prev = [makeProvider("openrouter", ["a", "b", "c", "d", "e"])];
      // Same slug, same count (5), but every id replaced — overlap 0%.
      const next = [makeProvider("openrouter", ["z1", "z2", "z3", "z4", "z5"])];
      const result = snapshotDiff(prev, next);
      assert.strictEqual(result.ok, false, "ok should be false");
      assert.ok(
        result.errors.some((e) => e.includes("openrouter") && e.includes("churned")),
        `expected churn error for "openrouter", got: ${result.errors.join("; ")}`,
      );
      assert.ok(
        result.stats.churned.some((c) => c.slug === "openrouter"),
        "churned array should include 'openrouter'",
      );
    });

    // ── (f) Normal churn (1 of 5 ids changes) stays ok=true ──────────────────
    run("(f) normal id churn (1/5 changes) → ok=true", () => {
      const prev = [makeProvider("openrouter", ["a", "b", "c", "d", "e"])];
      // One id swapped (e → f): 80% overlap, well above default 50% floor.
      const next = [makeProvider("openrouter", ["a", "b", "c", "d", "f"])];
      const result = snapshotDiff(prev, next);
      assert.strictEqual(result.ok, true, `ok should be true, errors: ${result.errors.join("; ")}`);
      assert.strictEqual(result.stats.churned.length, 0, "no churn expected");
    });

    // ── (g) Single provider disappears but catalog grows → ok=true (benign churn) ─
    run("(g) 1 disappeared + net growth → ok=true (warning, not error)", () => {
      const prev = [
        makeProvider("mistral-codestral", ["c1", "c2", "c3"]),
        makeProvider("openrouter", ["m1", "m2", "m3"]),
      ];
      // mistral-codestral removed upstream, but two new providers added → net grows.
      const next = [
        makeProvider("openrouter", ["m1", "m2", "m3", "m4"]),
        makeProvider("groq", ["g1", "g2"]),
        makeProvider("cerebras", ["x1", "x2"]),
      ];
      const result = snapshotDiff(prev, next);
      assert.strictEqual(result.ok, true, `ok should be true, errors: ${result.errors.join("; ")}`);
      assert.ok(
        result.warnings.some((w) => w.includes("mistral-codestral") && w.includes("upstream churn")),
        `expected benign-churn warning, got: ${result.warnings.join("; ")}`,
      );
      assert.ok(
        result.stats.disappeared.includes("mistral-codestral"),
        "disappeared array should still record 'mistral-codestral'",
      );
    });

    // ── (h) Multiple disappear (> maxDisappeared) even with growth → ok=false ─────
    run("(h) 2 disappeared exceeds tolerance → ok=false", () => {
      const prev = [
        makeProvider("a", ["a1", "a2"]),
        makeProvider("b", ["b1", "b2"]),
        makeProvider("c", ["c1", "c2"]),
      ];
      // a and b both vanish; one big new provider keeps counts up.
      const next = [
        makeProvider("c", ["c1", "c2"]),
        makeProvider("big", ["n1", "n2", "n3", "n4", "n5", "n6"]),
      ];
      const result = snapshotDiff(prev, next, { maxDisappeared: 1 });
      assert.strictEqual(result.ok, false, "ok should be false (2 disappeared > tolerance)");
      assert.ok(
        result.errors.some((e) => e.includes("disappeared")),
        `expected disappeared errors, got: ${result.errors.join("; ")}`,
      );
    });

    // ── (i) 1 disappeared but net provider shrink → ok=false ─────────────────────
    run("(i) 1 disappeared with net shrink → ok=false", () => {
      const prev = [
        makeProvider("a", ["a1", "a2"]),
        makeProvider("b", ["b1", "b2"]),
      ];
      // a vanishes, nothing added → fewer providers → real loss.
      const next = [makeProvider("b", ["b1", "b2", "b3"])];
      const result = snapshotDiff(prev, next);
      assert.strictEqual(result.ok, false, "ok should be false (net provider shrink)");
      assert.ok(
        result.errors.some((e) => e.includes("\"a\"") && e.includes("disappeared")),
        `expected disappeared error for "a", got: ${result.errors.join("; ")}`,
      );
    });

    // ── (j) 1 provider churns ids but catalog grows → ok=true (benign) ───────────
    // Real-world: NVIDIA NIM rotates its model catalog (ids churn > 50%) while the
    // overall catalog grows. Isolated churn + net growth = upstream churn, not
    // corruption → warning, run still ships.
    run("(j) id churn + net model growth → ok=true (warning, not error)", () => {
      const prev = [
        makeProvider("nvidia-nim", ["m1", "m2", "m3", "m4", "m5"]),
        makeProvider("other", ["o1", "o2"]),
      ];
      // nvidia-nim rotates most ids (overlap 20%), and a new provider adds models
      // so the total grows (7 → 10).
      const next = [
        makeProvider("nvidia-nim", ["m1", "z2", "z3", "z4", "z5"]),
        makeProvider("other", ["o1", "o2"]),
        makeProvider("fresh", ["f1", "f2", "f3"]),
      ];
      const result = snapshotDiff(prev, next);
      assert.strictEqual(result.ok, true, "ok should be true (churn on a growing catalog)");
      assert.ok(
        result.errors.length === 0,
        `expected no errors, got: ${result.errors.join("; ")}`,
      );
      assert.ok(
        result.warnings.some((w) => w.includes("nvidia-nim") && w.includes("upstream churn")),
        `expected benign-churn warning, got: ${result.warnings.join("; ")}`,
      );
      assert.ok(
        result.stats.churned.some((c) => c.slug === "nvidia-nim"),
        "churned array should still record 'nvidia-nim'",
      );
    });

    console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
  });
}
