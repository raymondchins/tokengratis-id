/**
 * scripts/lib/merge.mjs — Dedup + merge stage for tokengratis.id pipeline.
 *
 * Takes per-source ProviderPartial[][] and collapses them into the final
 * canonical Provider[] using a GAP-FILL-BY-PRIORITY policy:
 *   - Highest-priority source wins scalar fields when it has a non-null/non-empty value.
 *   - Lower-priority sources fill in gaps.
 *   - Models are unioned by modelKey(); colliding keys are merged (complement, not override).
 *
 * SOURCE_PRIORITY order (index 0 = highest, didefinisikan di normalize.mjs):
 *   openrouter.ai/api/v1/models → mnfst/awesome-free-llm-apis → freellm.net → cheahjs/free-llm-api-resources
 *
 * CATATAN openrouter @ TOP priority: adapter openrouter CUMA emit provider
 * "openrouter" dan live API = authoritative buat dirinya sendiri, jadi top
 * priority ga bisa ngaruh provider lain (mnfst tetap menang buat non-openrouter).
 *
 * Called by scripts/sync.mjs:
 *   import { mergeProviders } from './lib/merge.mjs';
 *   const providers = mergeProviders(partialGroups, new Date().toISOString());
 */

import {
  SOURCE_PRIORITY,
  modalitiesOf,
  maxContextOf,
  noTokenContext,
  domainOf,
  freeLimitOf,
  modelKey,
  slugify,
  ctxNum,
  cleanModality,
  stripMdLinks,
} from "./normalize.mjs";

// ─── Priority helpers ─────────────────────────────────────────────────────────

/** Index of a source name in SOURCE_PRIORITY; unknowns go to the end. */
function sourcePriority(sourceName) {
  const idx = SOURCE_PRIORITY.indexOf(sourceName);
  return idx === -1 ? SOURCE_PRIORITY.length : idx;
}

/** Compare two ProviderPartials by their source priority (ascending = higher priority first). */
function byPriority(a, b) {
  return sourcePriority(a.source.name) - sourcePriority(b.source.name);
}

// ─── Scalar gap-fill ──────────────────────────────────────────────────────────

/**
 * Return the first truthy (non-null, non-empty-string) value across `contributors`
 * for a given field name.  Falls back to `defaultVal` if none has it.
 */
function gapFill(contributors, field, defaultVal = null) {
  for (const c of contributors) {
    const v = c[field];
    if (v !== null && v !== undefined && v !== "") return v;
  }
  return defaultVal;
}

// ─── Model merge ─────────────────────────────────────────────────────────────

/** Gap-fill null/empty model fields dari src ke target (id+name target dipertahankan). */
function gapFillModel(target, src) {
  if (!target.context && src.context) target.context = src.context;
  if (!target.maxOutput && src.maxOutput) target.maxOutput = src.maxOutput;
  if (!target.modality && src.modality) target.modality = cleanModality(src.modality);
  if (!target.rateLimit && src.rateLimit) target.rateLimit = src.rateLimit;
}

/** Dua kunci dedup per model: modelKey (nama-aware) + slugify(id) (id-aware). */
function modelKeysOf(m) {
  const ks = [];
  const kA = modelKey(m.name || m.id);
  const kB = slugify(m.id || m.name);
  if (kA) ks.push("a:" + kA);
  if (kB) ks.push("b:" + kB);
  return ks;
}

/**
 * Merge model lists from all contributors (priority order, highest first).
 *
 * DUAL-KEY UNION: dua model dianggap SAMA kalau berbagi modelKey ATAU slugify(id).
 * Ini nangkep dua pola dupe lintas-sumber:
 *   - nama beda tapi id/slug sama  → "Command A" (id command-a-03-2025) vs "command-a-03-2025"
 *   - id beda tapi nama sama       → "moonshotai/kimi-k2.6:free" vs "MoonshotAI: Kimi K2.6 (free)"
 * Model yang ga berbagi kunci apa-apa = beda model (di-union, ga di-drop).
 * id+name diambil dari kontributor prioritas tertinggi; field lain gap-fill.
 *
 * Final sort: ctxNum(context) DESC lalu name ASC — deterministik.
 */
function mergeModels(contributors) {
  const groups = []; // { base, keys:Set, order, dead }
  const keyIndex = new Map(); // key → group ref

  for (const contributor of contributors) {
    for (const model of contributor.models || []) {
      const keys = modelKeysOf(model);
      if (keys.length === 0) continue; // skip degenerate

      // Group eksisting yang nyentuh salah satu kunci model ini
      const hit = [
        ...new Set(keys.map((k) => keyIndex.get(k)).filter(Boolean)),
      ].sort((a, b) => a.order - b.order);

      let group;
      if (hit.length === 0) {
        group = {
          base: {
            id: model.id ?? "",
            name: model.name ?? "",
            context: model.context ?? null,
            maxOutput: model.maxOutput ?? null,
            modality: cleanModality(model.modality),
            rateLimit: model.rateLimit ?? null,
          },
          keys: new Set(keys),
          order: groups.length,
          dead: false,
        };
        groups.push(group);
      } else {
        // Keeper = group prioritas tertinggi (order terkecil). Group lain di-fold masuk.
        group = hit[0];
        for (let i = 1; i < hit.length; i++) {
          gapFillModel(group.base, hit[i].base); // keeper id/name menang
          for (const k of hit[i].keys) group.keys.add(k);
          hit[i].dead = true;
        }
        gapFillModel(group.base, model); // model masuk = prioritas lebih rendah/sama
        for (const k of keys) group.keys.add(k);
      }
      for (const k of group.keys) keyIndex.set(k, group);
    }
  }

  return groups
    .filter((g) => !g.dead)
    .map((g) => {
      const m = g.base;
      // Embeddings/rerank/transkripsi audio: nolin context+maxOutput yang
      // ke-gap-fill dari angka generik sumber sekunder (anti-halusinasi).
      if (noTokenContext(m.modality, m.id, m.name)) {
        m.context = null;
        m.maxOutput = null;
      }
      return m;
    })
    .sort((a, b) => {
      const ctxDiff = ctxNum(b.context) - ctxNum(a.context);
      if (ctxDiff !== 0) return ctxDiff;
      return (a.name || a.id || "").localeCompare(b.name || b.id || "");
    });
}

// ─── Source provenance ────────────────────────────────────────────────────────

/**
 * Build the Provider.sources[] array from contributors.
 * Deduped by source.name, ordered by SOURCE_PRIORITY, each entry kept whole.
 */
function mergeSources(contributors) {
  const seen = new Map(); // name → SourceRef
  for (const c of contributors) {
    if (c.source && c.source.name && !seen.has(c.source.name)) {
      seen.set(c.source.name, { ...c.source });
    }
  }
  // Sort by priority
  return [...seen.values()].sort(
    (a, b) => sourcePriority(a.name) - sourcePriority(b.name)
  );
}

/** Max syncedAt across all source entries (ISO string comparison works because ISO 8601 sorts lexicographically). */
function maxSyncedAt(sources, fallback) {
  let best = fallback;
  for (const s of sources) {
    if (s.syncedAt && s.syncedAt > best) best = s.syncedAt;
  }
  return best;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Merge per-source ProviderPartial[][] into a canonical Provider[].
 *
 * @param {Array<Array<Object>>} partialGroups  - One array per source adapter.
 * @param {string}               mergeRunAt     - ISO timestamp of this merge run.
 * @returns {Array<Object>}                       Canonical Provider[], sorted by slug.
 */
export function mergeProviders(partialGroups, mergeRunAt) {
  // 1. Flatten all partials and group by canonical slug
  const bySlug = new Map(); // slug → ProviderPartial[]

  for (const group of partialGroups) {
    for (const partial of group) {
      const slug = partial.slug;
      if (!slug) continue;
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug).push(partial);
    }
  }

  const providers = [];

  for (const [slug, rawContributors] of bySlug) {
    // 2. Sort contributors by SOURCE_PRIORITY (highest priority = index 0)
    const contributors = [...rawContributors].sort(byPriority);

    // 3. GAP-FILL scalar fields — base (highest priority) wins; others fill gaps
    const name            = gapFill(contributors, "name", slug);
    const country         = gapFill(contributors, "country");
    const flag            = gapFill(contributors, "flag");
    const url             = gapFill(contributors, "url");
    const baseUrl         = gapFill(contributors, "baseUrl");
    // ANTI-HALUSINASI: kalau ga ada sumber yang punya description → null (di-omit
    // dari output), BUKAN "" yang jadi sel kosong.
    // stripMdLinks: buang sintaks markdown link mentah dari sumber (mis. mnfst
    // "[Ollama API](url)") biar prosa bersih di UI.
    const description     = stripMdLinks(gapFill(contributors, "description"));
    const sourceUpdatedAt = gapFill(contributors, "sourceUpdatedAt");
    let moreModels        = gapFill(contributors, "moreModels");

    // category: gap-fill only — no default fabrication (anti-halusinasi rule)
    const category = gapFill(contributors, "category");

    // 4. Merge models (union + complement gap-fill)
    const models = mergeModels(contributors);

    // 5. Compute derived fields
    const modalities = modalitiesOf(models);
    const modelCount = models.length;

    // Reconcile moreModels: if the "+N more" number is <= modelCount, those models
    // are already represented in the merged list — the note is now false/redundant.
    // Purely-qualitative notes (no number) are left untouched.
    if (moreModels) {
      const m = /(\d[\d,]*)\s*(?:more|additional)/i.exec(moreModels);
      if (m) {
        const claimed = parseInt(m[1].replace(/,/g, ""), 10);
        if (claimed <= modelCount) moreModels = null;
      }
    }
    const maxContext = maxContextOf(models);
    const domain     = domainOf(url, baseUrl);
    const logo       = domain ? `/logos/${slug}.png` : null;
    const freeLimit  = freeLimitOf(description);

    // 6. Provenance
    const sources  = mergeSources(contributors);
    const syncedAt = maxSyncedAt(sources, mergeRunAt);

    providers.push({
      slug,
      name,
      category,
      country,
      flag,
      domain,
      logo,
      url,
      baseUrl,
      ...(description ? { description } : {}),
      modalities,
      modelCount,
      maxContext,
      freeLimit,
      moreModels,
      models,
      sources,
      syncedAt,
      sourceUpdatedAt,
    });
  }

  // 7. Sort output deterministically by slug
  providers.sort((a, b) => a.slug.localeCompare(b.slug));

  return providers;
}

// ─── Inline smoke test (run with: node scripts/lib/merge.mjs) ─────────────────

if (
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("scripts/lib/merge.mjs")
) {
  const { SOURCE_PRIORITY: SP } = await import("./normalize.mjs");

  // Source A (mnfst — priority 0): Groq with context+modality, no rateLimit
  const sourceA = {
    name: SP[0], // "mnfst/awesome-free-llm-apis"
    url: "https://github.com/mnfst/awesome-free-llm-apis",
    syncedAt: "2026-06-01T10:00:00.000Z",
  };

  // Source B (cheahjs — priority 2): Groq with rateLimit, no context/modality
  const sourceB = {
    name: SP[2], // "cheahjs/free-llm-api-resources"
    url: "https://github.com/cheahjs/free-llm-api-resources",
    syncedAt: "2026-06-01T11:00:00.000Z",
  };

  const partialGroups = [
    // Group 0 — from source A
    [
      {
        slug: "groq",
        name: "Groq",
        category: "provider_api",
        country: "US",
        flag: "🇺🇸",
        url: "https://console.groq.com",
        baseUrl: "https://api.groq.com/openai/v1",
        description: "Free tier: 14,400 req/day, fast inference.",
        models: [
          {
            id: "llama-3.3-70b-versatile",
            name: "Llama 3.3 70B Versatile",
            context: "128K",
            maxOutput: "32K",
            modality: "Text",
            rateLimit: null, // missing in A
          },
          {
            id: "mixtral-8x7b",
            name: "Mixtral 8x7B",
            context: "32K",
            maxOutput: null,
            modality: "Text",
            rateLimit: null,
          },
        ],
        sourceUpdatedAt: "2026-05-30T00:00:00.000Z",
        moreModels: null,
        source: sourceA,
      },
    ],
    // Group 1 — from source B
    [
      {
        slug: "groq",
        name: "Groq Cloud", // lower priority — should lose on name
        category: null, // missing — should gap-fill from A
        country: null,
        flag: null,
        url: null, // missing
        baseUrl: null,
        description: "",
        models: [
          {
            id: "llama-3.3-70b-versatile",
            name: "Llama 3.3 70B", // same model, different name — but modelKey matches
            context: null, // missing in B
            maxOutput: null,
            modality: "", // missing
            rateLimit: "200 RPM, 100K TPM", // only in B
          },
        ],
        sourceUpdatedAt: null,
        moreModels: null,
        source: sourceB,
      },
      // Provider unique to source B only
      {
        slug: "together-ai",
        name: "Together AI",
        category: "inference_provider",
        country: "US",
        flag: "🇺🇸",
        url: "https://api.together.xyz",
        baseUrl: "https://api.together.xyz/v1",
        description: "$1 free credit on signup.",
        models: [
          {
            id: "together-llama-3",
            name: "Llama 3",
            context: "8K",
            maxOutput: null,
            modality: "Text",
            rateLimit: "60 RPM",
          },
        ],
        sourceUpdatedAt: null,
        moreModels: null,
        source: sourceB,
      },
    ],
  ];

  const result = mergeProviders(partialGroups, "2026-06-01T12:00:00.000Z");

  console.log("\n=== SMOKE TEST ===\n");

  // (a) Groq appears exactly once
  const groq = result.filter((p) => p.slug === "groq");
  console.assert(groq.length === 1, "FAIL (a): Groq should appear exactly once");
  console.log(`(a) Groq count = ${groq.length} (expected 1) — ${groq.length === 1 ? "PASS" : "FAIL"}`);

  // (b) shared model has BOTH context (from A) and rateLimit (from B) filled
  const groqProvider = groq[0];
  const llama = groqProvider.models.find((m) => /llama.*3.*3.*70b/i.test(m.name) || /llama.*70b/i.test(m.name));
  const hasContext   = !!llama?.context;
  const hasRateLimit = !!llama?.rateLimit;
  console.assert(hasContext,   "FAIL (b): Llama model should have context from source A");
  console.assert(hasRateLimit, "FAIL (b): Llama model should have rateLimit from source B");
  console.log(`(b) Llama 70B context="${llama?.context}", rateLimit="${llama?.rateLimit}" — ${hasContext && hasRateLimit ? "PASS" : "FAIL"}`);

  // (c) sources[] has 2 entries ordered by priority (mnfst first, cheahjs second)
  const srcNames = groqProvider.sources.map((s) => s.name);
  const srcOk = srcNames.length === 2 && srcNames[0] === SP[0] && srcNames[1] === SP[2];
  console.log(`(c) sources = ${JSON.stringify(srcNames)} — ${srcOk ? "PASS" : "FAIL"}`);

  // (d) together-ai (unique to source B) still appears
  const together = result.filter((p) => p.slug === "together-ai");
  console.assert(together.length === 1, "FAIL (d): together-ai should appear once");
  console.log(`(d) together-ai count = ${together.length} (expected 1) — ${together.length === 1 ? "PASS" : "FAIL"}`);

  // Additional: Groq name came from higher-priority source A, not "Groq Cloud"
  const nameOk = groqProvider.name === "Groq";
  console.log(`(e) Groq name="${groqProvider.name}" (expected "Groq") — ${nameOk ? "PASS" : "FAIL"}`);

  // Additional: category gap-filled from A
  const catOk = groqProvider.category === "provider_api";
  console.log(`(f) Groq category="${groqProvider.category}" (expected "provider_api") — ${catOk ? "PASS" : "FAIL"}`);

  // Additional: slug order is deterministic (groq < together-ai)
  const slugOrder = result.map((p) => p.slug);
  console.log(`(g) slug order = ${JSON.stringify(slugOrder)} — ${slugOrder[0] < slugOrder[1] ? "PASS (sorted)" : "FAIL"}`);

  // Summary
  console.log("\nFull Groq provider:");
  console.log(JSON.stringify(groqProvider, null, 2));
}
