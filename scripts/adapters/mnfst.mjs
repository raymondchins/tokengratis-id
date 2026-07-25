// Adapter: mnfst/awesome-free-llm-apis
// Fetches https://raw.githubusercontent.com/mnfst/awesome-free-llm-apis/main/data.json
// and normalises to ProviderPartial[].
//
// Contract: export async function fetchProviders() → ProviderPartial[]
// (see scripts/lib/normalize.mjs for shape + helper docs)
//
// Do NOT add domain/logo/modalities/modelCount/maxContext/freeLimit here —
// those are computed at merge stage.
//
// SHAPE GUARDS (added after INCIDENT 2026-07-25 — see freellm.mjs header for
// the full story: freellm.net silently shifted a column, context got filled
// with a "Score" number, row/column COUNTS stayed normal so every count-based
// guard passed, and it took a human eyeballing the CLI output to catch it).
//
// This adapter consumes JSON, so it can't suffer a *column* shift — but the
// same disease applies at the *field* level: this file blindly trusts that
// data.json still has `providers[].models[].{id,context,modality,rateLimit}`
// in the shape it has today. If mnfst renames/moves/retypes a field, the old
// code would happily emit `context: null` for every model (or `"[object
// Object]"` if a field became an object) and write it to providers.json
// looking completely normal. So: validate the top-level shape before mapping,
// track per-field fill-rate across the WHOLE fetch, and throw loud (not
// silent-null) if a field that's normally ~100% filled collapses to ~0% —
// that pattern means "field got renamed", not "source is sparse tonight".
// sync.mjs already tolerates a thrown adapter (skips that source for the
// night) — failing loud here is strictly safer than writing quiet garbage.

import { canonicalSlug, safeUrl, cleanStr, SOURCES } from "../lib/normalize.mjs";

const SRC_URL =
  "https://raw.githubusercontent.com/mnfst/awesome-free-llm-apis/main/data.json";

/** Human-readable type label for error messages (null/array/typeof). */
function describeType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return `array(len=${v.length})`;
  return typeof v;
}

/**
 * Terima CUMA string/number lalu delegate ke cleanStr(). Kalau upstream ganti
 * tipe field (mis. context jadi object `{tokens: 128000}` bukan string
 * "128K"), JANGAN biarin itu ke-stringify jadi "[object Object]" — itu persis
 * pola INCIDENT 2026-07-25 (nilai salah tapi "sukses" ke-render, ga ada error
 * yang keliatan). Object/array/boolean → null, bukan ditebak/dipaksa string.
 * @param {unknown} v
 * @returns {string|null}
 */
function scalarOrNull(v) {
  if (v == null) return null;
  if (typeof v !== "string" && typeof v !== "number") return null;
  return cleanStr(v);
}

/** typeof-string guard + falsy→null, tanpa nyoba stringify tipe lain. */
function strOrNull(v) {
  return typeof v === "string" ? v || null : null;
}

/**
 * Fetch and normalise providers from mnfst/awesome-free-llm-apis.
 * @returns {Promise<import('../lib/normalize.mjs').ProviderPartial[]>}
 */
export async function fetchProviders() {
  const res = await fetch(SRC_URL, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`mnfst fetch failed: ${res.status}`);
  const data = await res.json();

  // ── Shape guard #1: top-level ────────────────────────────────────────────
  // Kalau data.json berubah jadi array langsung / null / string dsb, jangan
  // diam-diam nyoba .map dan nge-throw generic TypeError yang ga jelas asalnya
  // — named error biar ketauan dari log CI apa yang berubah upstream.
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(
      `mnfst.mjs: expected top-level JSON object ({ providers: [...] }), got ` +
        `${describeType(data)} — upstream data.json shape berubah total. ` +
        `Lihat INCIDENT 2026-07-25 (freellm.mjs) sebelum nge-guess mapping baru.`,
    );
  }
  if (!Array.isArray(data.providers)) {
    throw new Error(
      `mnfst.mjs: expected "providers" to be an array, got ` +
        `${describeType(data.providers)} — field kemungkinan di-rename atau ` +
        `dipindah nesting upstream. JANGAN tebak indeks/path baru sebelum cek ` +
        `manual data.json. Lihat INCIDENT 2026-07-25.`,
    );
  }
  if (data.providers.length === 0) {
    throw new Error(
      `mnfst.mjs: "providers" array ada tapi 0 entries — kemungkinan restructure ` +
        `upstream (mis. providers dipindah ke key lain), bukan source yang beneran ` +
        `kosong. Lihat INCIDENT 2026-07-25.`,
    );
  }

  const syncedAt = new Date().toISOString();
  const sourceUpdatedAt = strOrNull(data.lastUpdated);

  // ── Fill-rate tracking (systemic rename/restructure detector) ───────────
  // mnfst historis punya id/context/modality/rateLimit NYARIS SELALU terisi
  // (live-checked 2026-07-25: 118/118 model entries). Kalau rasio anjlok ke
  // ~0% padahal sample cukup besar, itu bukan "sumber lagi sparse malam ini"
  // — itu field yang ke-rename/pindah nesting. Guard ini yang nangkep pola
  // itu; guard di bawah (badProviderShape) nangkep restructure di level
  // provider (models bukan array lagi, dsb).
  let badProviderShape = 0;
  let modelEntries = 0;
  let modelsWithId = 0;
  let modelsWithContext = 0;
  let modelsWithModality = 0;

  const providers = [];

  for (const p of data.providers) {
    if (!p || typeof p !== "object" || typeof p.name !== "string" || !p.name.trim()) {
      badProviderShape++;
      continue; // satu provider tanpa nama usable — skip, jangan bikin card corrupt
    }
    if (p.models != null && !Array.isArray(p.models)) {
      badProviderShape++; // "models" field ada tapi bukan array — bentuk berubah
    }
    const rawModels = Array.isArray(p.models) ? p.models : [];

    const allModels = rawModels.map((m) => {
      modelEntries++;
      const idVal = typeof m?.id === "string" && m.id.trim() ? m.id.trim() : null;
      if (idVal) modelsWithId++;
      const contextVal = scalarOrNull(m?.context);
      if (contextVal) modelsWithContext++;
      const modalityVal = strOrNull(m?.modality);
      if (modalityVal) modelsWithModality++;

      return {
        id: idVal,
        name: strOrNull(m?.name),
        context: contextVal,
        maxOutput: scalarOrNull(m?.maxOutput),
        modality: modalityVal,
        rateLimit: scalarOrNull(m?.rateLimit),
      };
    });

    // Sumber kadang nyelipin baris "catatan" (id null), mis. "+ 42 more models".
    // Pisahin: real models = truthy id. Note text disimpan di moreModels (extra
    // field — merge stage reads it) dan di-append ke description sebagai fallback.
    // Real models = truthy id, deduped by id (defensive parity with
    // freellm/cheahjs — a duplicate row in upstream data.json would otherwise
    // inflate modelCount → the sanity baseline; see docs/log.md INCIDENT 2026-07-17).
    const seenIds = new Set();
    const models = allModels.filter((m) => {
      if (!m.id || seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return true;
    });
    const moreEntry = allModels.find((m) => !m.id && m.name);
    const moreModels = moreEntry ? moreEntry.name.replace(/^\+\s*/, "").trim() : null;

    providers.push({
      slug: canonicalSlug(p.name),
      name: p.name,
      category: strOrNull(p.category),
      country: strOrNull(p.country),
      flag: strOrNull(p.flag),
      url: safeUrl(strOrNull(p.url)),
      baseUrl: safeUrl(strOrNull(p.baseUrl)),
      description: typeof p.description === "string" ? p.description : "",
      models,
      moreModels,
      sourceUpdatedAt,
      source: { ...SOURCES.mnfst, syncedAt },
    });
  }

  // ── Shape guard #2: too many provider entries structurally unusable ─────
  const providerBadRatio = badProviderShape / data.providers.length;
  if (data.providers.length >= 5 && providerBadRatio > 0.5) {
    throw new Error(
      `mnfst.mjs: ${badProviderShape}/${data.providers.length} provider entries ` +
        `punya bentuk ga terduga (name bukan string, atau "models" bukan array) — ` +
        `kemungkinan besar upstream restructure schema, bukan data rusak satu-dua ` +
        `entri. Lihat INCIDENT 2026-07-25.`,
    );
  }

  // ── Shape guard #3: systemic field loss (rename/nesting change) ─────────
  const guardFieldFillRate = (count, label) => {
    if (modelEntries < 20) return; // sample kekecilan buat narik kesimpulan valid
    const ratio = count / modelEntries;
    if (ratio < 0.1) {
      throw new Error(
        `mnfst.mjs: cuma ${count}/${modelEntries} (${(ratio * 100).toFixed(1)}%) ` +
          `model entries punya "${label}" — field ini historis nyaris selalu ada ` +
          `(mnfst = "data level-model lengkap: context, modality, rate limit" per ` +
          `CLAUDE.md). Rasio segini nunjukin field di-rename/dipindah nesting ` +
          `upstream, BUKAN data beneran hilang malam ini. Cek data.json manual ` +
          `sebelum ubah mapping. Lihat INCIDENT 2026-07-25.`,
      );
    }
  };
  guardFieldFillRate(modelsWithId, "id");
  guardFieldFillRate(modelsWithContext, "context");
  guardFieldFillRate(modelsWithModality, "modality");

  return providers;
}

// ─── Self-test ────────────────────────────────────────────────────────────────
// Run: node scripts/adapters/mnfst.mjs --selftest
// Feeds deliberately malformed payloads through the SAME validation path
// fetchProviders() uses (top-level shape guard + fill-rate guard), proving
// the guards actually throw instead of silently degrading. Network-free —
// mocks global.fetch. Exit 1 on any failure (mirrors scripts/lib/source-sanity.mjs
// --selftest convention).

if (process.argv.includes("--selftest")) {
  const { default: assert } = await import("node:assert");

  let passed = 0;
  let failed = 0;

  /** Run fetchProviders() against a mocked fetch payload; return the thrown message or null. */
  async function runWithPayload(payload) {
    const realFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    try {
      await fetchProviders();
      return null; // no throw
    } catch (e) {
      return e.message;
    } finally {
      global.fetch = realFetch;
    }
  }

  async function test(description, fn) {
    try {
      await fn();
      console.log(`  PASS  ${description}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL  ${description}`);
      console.error(`        ${err.message}`);
      failed++;
    }
  }

  console.log("mnfst.mjs self-test");
  console.log("─".repeat(60));

  await test("throws when top-level JSON is an array, not an object", async () => {
    const msg = await runWithPayload([1, 2, 3]);
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/top-level JSON object/.test(msg), `unexpected message: ${msg}`);
  });

  await test('throws when "providers" is renamed away (missing)', async () => {
    const msg = await runWithPayload({ lastUpdated: "2026-07-25", entries: [{ name: "X" }] });
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/"providers" to be an array/.test(msg), `unexpected message: ${msg}`);
  });

  await test('throws when "providers" is present but not an array', async () => {
    const msg = await runWithPayload({ providers: { foo: "bar" } });
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/"providers" to be an array/.test(msg), `unexpected message: ${msg}`);
  });

  await test('throws when "providers" is an empty array', async () => {
    const msg = await runWithPayload({ providers: [] });
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/0 entries/.test(msg), `unexpected message: ${msg}`);
  });

  await test('throws when "context" is renamed to "contextWindow" across the board (systemic field loss)', async () => {
    const models = Array.from({ length: 25 }, (_, i) => ({
      id: `model-${i}`,
      name: `Model ${i}`,
      contextWindow: "128K", // renamed — adapter still reads m.context
      maxOutput: "8K",
      modality: "Text",
      rateLimit: "10 RPM",
    }));
    const msg = await runWithPayload({
      providers: [{ name: "TestProvider", models }],
    });
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/"context"/.test(msg), `unexpected message: ${msg}`);
  });

  await test('throws when "id" becomes an object across the board (nesting change)', async () => {
    const models = Array.from({ length: 25 }, (_, i) => ({
      id: { value: `model-${i}` }, // nesting changed — id no longer a plain string
      name: `Model ${i}`,
      context: "128K",
      modality: "Text",
    }));
    const msg = await runWithPayload({
      providers: [{ name: "TestProvider", models }],
    });
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/"id"/.test(msg), `unexpected message: ${msg}`);
  });

  await test("does NOT stringify an object context value into '[object Object]' (single odd entry, not systemic)", async () => {
    const models = [
      { id: "weird-1", name: "Weird", context: { tokens: 128000 }, modality: "Text" },
      ...Array.from({ length: 24 }, (_, i) => ({
        id: `model-${i}`,
        name: `Model ${i}`,
        context: "128K",
        modality: "Text",
      })),
    ];
    const result = await (async () => {
      const realFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ providers: [{ name: "TestProvider", models }] }),
      });
      try {
        return await fetchProviders();
      } finally {
        global.fetch = realFetch;
      }
    })();
    const weird = result[0].models.find((m) => m.id === "weird-1");
    assert.strictEqual(weird.context, null, `expected null, got: ${JSON.stringify(weird.context)}`);
    assert.ok(
      !result[0].models.some((m) => m.context === "[object Object]"),
      "an object value leaked through as the literal string [object Object]",
    );
  });

  await test("healthy payload (normal shape) does not throw", async () => {
    const models = Array.from({ length: 25 }, (_, i) => ({
      id: `model-${i}`,
      name: `Model ${i}`,
      context: "128K",
      maxOutput: "8K",
      modality: "Text",
      rateLimit: "10 RPM",
    }));
    const msg = await runWithPayload({
      lastUpdated: "2026-07-25",
      providers: [{ name: "TestProvider", category: "provider_api", models }],
    });
    assert.strictEqual(msg, null, `expected no throw, got: ${msg}`);
  });

  console.log("\n" + "─".repeat(60));
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("All tests passed.");
  }
}
