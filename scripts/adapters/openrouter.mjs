// Adapter: openrouter.ai/api/v1/models
// Fetches https://openrouter.ai/api/v1/models (public, no auth) dan
// normalises ke ProviderPartial[] — satu provider: OpenRouter.
//
// Contract: export async function fetchProviders() → ProviderPartial[]
// (lihat scripts/lib/normalize.mjs untuk shape + helper docs)
//
// Filter: HANYA model dengan id yang berakhir ':free'.
//   Alasan: model tanpa suffix ':free' di OpenRouter adalah model berbayar —
//   beberapa mungkin punya harga nol sementara (pricing.prompt === "0") tapi
//   itu bisa berubah sewaktu-waktu tanpa ganti nama. Hanya ':free' yang
//   secara eksplisit dijanjikan gratis oleh OpenRouter. Precision > recall
//   adalah aturan anti-halusinasi direktori ini.
//
// NO rateLimit: OpenRouter /api/v1/models tidak mengekspos rate limit
// per-model secara terstruktur → field di-omit (null). Jangan nebak.
//
// SHAPE GUARDS (added after INCIDENT 2026-07-25 — see freellm.mjs header for
// the full incident: freellm.net silently shifted a column, a "Score" number
// ended up in the context field, row/column COUNTS stayed normal so every
// count-based guard passed, and only a human eyeballing the CLI output caught
// it). This adapter consumes a JSON API, so it can't suffer a *column* shift,
// but it has the same underlying disease: it blindly trusts that OpenRouter's
// response still has `data[].{id,context_length,architecture.input_modalities,
// top_provider.max_completion_tokens}` in today's shape, and that the ':free'
// id suffix is still how OpenRouter marks a model as free. If any of those
// silently changed, the OLD code would happily emit 0 free models (looks like
// "OpenRouter has no free models tonight" — plausible-looking, wrong) or
// `context: "[object Object]"` if a field's type changed. This adapter has NO
// registered baseline in scripts/lib/source-sanity.mjs (it's JSON-only, added
// after that floor mechanism), so an internal guard here is the ONLY defense
// against a silent 0-model or garbled-field outcome — sync.mjs's floor check
// can't catch it. Failing loud (throw) is safe: sync.mjs skips a throwing
// source for the night and keeps last-known-good data live.

import { safeUrl, cleanStr, cleanModality } from "../lib/normalize.mjs";

const API_URL = "https://openrouter.ai/api/v1/models";

// SourceRef untuk provenance — URL = endpoint yang di-fetch (sumber langsung).
const SOURCE_REF = {
  name: "openrouter.ai/api/v1/models",
  url: API_URL,
};

/** Human-readable type label for error messages (null/array/typeof). */
function describeType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return `array(len=${v.length})`;
  return typeof v;
}

/**
 * Terima CUMA string/number lalu delegate ke cleanStr(). Kalau OpenRouter
 * ganti tipe field (mis. `name` jadi object bukan string), JANGAN biarin itu
 * ke-stringify jadi "[object Object]" — persis pola INCIDENT 2026-07-25
 * (nilai salah tapi "sukses" ke-render, ga ada error yang keliatan).
 * @param {unknown} v
 * @returns {string|null}
 */
function scalarOrNull(v) {
  if (v == null) return null;
  if (typeof v !== "string" && typeof v !== "number") return null;
  return cleanStr(v);
}

/** Only accept a finite number — a retyped field (string/object) becomes null, never NaN. */
function numOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Konversi context_length (integer token) → display string ringkas.
 * 1_048_576 → "1M", 131_072 → "131K", 32_768 → "32K".
 * Null-safe: falsy → null.
 * @param {number|null|undefined} n
 * @returns {string|null}
 */
function fmtContext(n) {
  if (!n) return null;
  if (n >= 1_000_000) {
    // Hindari ".0": 1_000_000 → "1M", bukan "1.0M"
    const v = n / 1_000_000;
    return (v % 1 === 0 ? String(v) : v.toFixed(3).replace(/\.?0+$/, "")) + "M";
  }
  if (n >= 1_000) {
    const v = Math.round(n / 1_000);
    return v + "K";
  }
  return String(n);
}

/**
 * Derive modality string dari input_modalities array OpenRouter.
 * Output: string yang dikenali facetsOf() di normalize.mjs
 * ("Text", "Text + Vision", "Text + Vision + Audio + Video", dsb.)
 *
 * OpenRouter input_modalities values yang pernah ketemu di :free models:
 *   ["text"]                               → "Text"
 *   ["image", "text"]                      → "Text + Vision"
 *   ["image", "text", "video"]             → "Text + Vision + Video"
 *   ["audio", "image", "text", "video"]    → "Text + Vision + Audio + Video"
 *
 * Anti-halusinasi: kalau bukan array (nesting/tipe berubah) atau kosong →
 * null (jangan nebak "text", jangan crash kalau upstream ganti tipe field).
 * @param {unknown} inputModalities
 * @returns {string|null}
 */
function deriveModality(inputModalities) {
  if (!Array.isArray(inputModalities) || inputModalities.length === 0) return null;
  const parts = [];
  // Urutan canonical: text dulu, lalu vision (image), audio, video
  if (inputModalities.includes("text")) parts.push("Text");
  if (inputModalities.includes("image")) parts.push("Vision");
  if (inputModalities.includes("audio")) parts.push("Audio");
  if (inputModalities.includes("video")) parts.push("Video");
  return parts.length > 0 ? parts.join(" + ") : null;
}

/**
 * Fetch dan normalise model gratis dari OpenRouter API.
 * Emit SATU provider: slug "openrouter" (slug canonical — dedup-key yang
 * dipakai sumber lain, lihat ALIAS map di normalize.mjs).
 *
 * @returns {Promise<import('../lib/normalize.mjs').ProviderPartial[]>}
 */
export async function fetchProviders() {
  const res = await fetch(API_URL, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`openrouter fetch failed: ${res.status}`);

  const data = await res.json();

  // ── Shape guard #1: top-level ────────────────────────────────────────────
  // Kalau API response berubah bentuk total (bukan { data: [...] } lagi),
  // jangan diam-diam nyoba .filter dan nge-throw TypeError generic — named
  // error biar ketauan dari log CI apa yang berubah upstream.
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(
      `openrouter.mjs: expected top-level JSON object ({ data: [...] }), got ` +
        `${describeType(data)} — upstream API shape berubah total. Lihat ` +
        `INCIDENT 2026-07-25 (freellm.mjs) sebelum nge-guess mapping baru.`,
    );
  }
  if (!Array.isArray(data.data)) {
    throw new Error(
      `openrouter.mjs: expected "data" to be an array, got ` +
        `${describeType(data.data)} — field kemungkinan di-rename/restructure ` +
        `upstream. Lihat INCIDENT 2026-07-25.`,
    );
  }
  // Total models (paid + free) turun ke 0 = API kosong/berubah drastis, BUKAN
  // "semua model dihapus dalam semalam" — cek ini SEBELUM filter ':free' biar
  // ga ketuker sama skenario "OpenRouter genuinely 0 model gratis hari ini".
  if (data.data.length === 0) {
    throw new Error(
      `openrouter.mjs: "data" array ada tapi 0 model total (termasuk berbayar) — ` +
        `API kemungkinan down/restructure, bukan katalog yang beneran kosong. ` +
        `Lihat INCIDENT 2026-07-25.`,
    );
  }

  const syncedAt = new Date().toISOString();

  // Filter ketat: hanya id yang berakhiran ':free'
  const freeModels = data.data.filter(
    (m) => m && typeof m.id === "string" && m.id.endsWith(":free"),
  );

  // ── Shape guard #2: ':free' convention change ────────────────────────────
  // data.data sehat (banyak model total) tapi 0 yang cocok suffix ':free' —
  // itu pola "konvensi id berubah", bukan "OpenRouter kebetulan lagi 0 model
  // gratis" (implausible di API yang barusan nunjukin puluhan/ratusan model
  // total). Diam-diam nulis provider openrouter 0-model itu berbahaya: step
  // 2c di sync.mjs treat openrouter live API sebagai ground truth buat
  // dirinya sendiri, jadi 0 palsu bisa nyasar jadi "tutorial" data hilang.
  if (data.data.length >= 20 && freeModels.length === 0) {
    throw new Error(
      `openrouter.mjs: ${data.data.length} model total tapi 0 yang cocok suffix ` +
        `":free" — kemungkinan besar OpenRouter ganti konvensi penanda model ` +
        `gratis (dulu id diakhiri ":free"). JANGAN diam-diam tulis 0 model ` +
        `openrouter — cek beberapa id model manual dulu. Lihat INCIDENT 2026-07-25.`,
    );
  }

  // Dedup by id (defensive parity with the other adapters — cheap insurance
  // against a live-API glitch double-listing an id → inflated sanity baseline).
  const seenIds = new Set();
  const dedupedFree = freeModels.filter((m) => {
    if (seenIds.has(m.id)) return false;
    seenIds.add(m.id);
    return true;
  });

  // ── Fill-rate tracking (systemic rename/restructure detector) ───────────
  // Live-checked 2026-07-25: 15/15 :free models punya context_length numerik
  // dan input_modalities non-kosong. Kalau rasio anjlok ke ~0% padahal sample
  // cukup, itu field yang ke-rename/pindah nesting (mis. context_length →
  // contextWindow, atau architecture di-restructure) — bukan data yang
  // beneran hilang. Threshold sample kecil (>=5) karena total :free models
  // OpenRouter historis cuma belasan.
  let modelsWithContext = 0;
  let modelsWithModality = 0;

  const models = dedupedFree.map((m) => {
    const ctxTokens = numOrNull(m.context_length);
    if (ctxTokens != null) modelsWithContext++;
    // max_completion_tokens dari top_provider — hanya kalau ada & numerik
    const maxOutputTokens = numOrNull(m.top_provider?.max_completion_tokens);
    const modalityDerived = deriveModality(m.architecture?.input_modalities);
    if (modalityDerived) modelsWithModality++;

    return {
      // Pertahankan full id termasuk ':free' — itu yang dipanggil user ke API
      id: m.id,
      name: scalarOrNull(m.name) ?? m.id,
      context: fmtContext(ctxTokens),
      // maxOutput: hanya dari top_provider.max_completion_tokens (ada di sumber)
      maxOutput: fmtContext(maxOutputTokens),
      modality: cleanModality(modalityDerived),
      // rateLimit: OpenRouter /api/v1/models tidak ekspos ini → null (anti-halusinasi)
      rateLimit: null,
    };
  });

  if (dedupedFree.length >= 5) {
    const ctxRatio = modelsWithContext / dedupedFree.length;
    if (ctxRatio < 0.2) {
      throw new Error(
        `openrouter.mjs: cuma ${modelsWithContext}/${dedupedFree.length} ` +
          `(${(ctxRatio * 100).toFixed(1)}%) model :free punya "context_length" ` +
          `numerik — field ini historis nyaris selalu ada. Pola ini nunjukin ` +
          `field di-rename/tipe berubah upstream, BUKAN data beneran hilang. ` +
          `Lihat INCIDENT 2026-07-25.`,
      );
    }
    const modalityRatio = modelsWithModality / dedupedFree.length;
    if (modalityRatio < 0.2) {
      throw new Error(
        `openrouter.mjs: cuma ${modelsWithModality}/${dedupedFree.length} ` +
          `(${(modalityRatio * 100).toFixed(1)}%) model :free punya ` +
          `"architecture.input_modalities" terisi — field ini historis nyaris ` +
          `selalu ada. Pola ini nunjukin nesting/tipe field berubah upstream, ` +
          `BUKAN data beneran hilang. Lihat INCIDENT 2026-07-25.`,
      );
    }
  }

  return [
    {
      // Slug WAJIB match slug canonical — sumber lain track "openrouter" dengan slug ini.
      // JANGAN pakai canonicalSlug("OpenRouter") — sudah "openrouter", sama saja.
      // Hard-code buat kejelasan + biar ga kena efek samping kalau ALIAS berubah.
      slug: "openrouter",
      name: "OpenRouter",
      // category + country: null — API tidak menyediakan field ini secara
      // terstruktur. Gap-fill dari sumber lain (mnfst/cheahjs) yang punya data ini.
      // Anti-halusinasi: jangan isi "inference_provider" / "US" dari pengetahuan luar.
      category: null,
      country: null,
      flag: null,
      // url = halaman API key OpenRouter (live, verified)
      url: safeUrl("https://openrouter.ai/settings/keys"),
      baseUrl: safeUrl("https://openrouter.ai/api/v1"),
      // description: kosong — sumber API tidak menyediakan deskripsi provider.
      // Sumber lain (mnfst) yang punya; merge akan gap-fill.
      description: "",
      models,
      moreModels: null,
      sourceUpdatedAt: null,
      source: { ...SOURCE_REF, syncedAt },
    },
  ];
}

// ─── Self-test ────────────────────────────────────────────────────────────────
// Run: node scripts/adapters/openrouter.mjs --selftest
// Feeds deliberately malformed payloads through the SAME validation path
// fetchProviders() uses (top-level shape guard, ':free' convention guard,
// fill-rate guard), proving the guards actually throw instead of silently
// degrading. Network-free — mocks global.fetch. Exit 1 on any failure
// (mirrors scripts/lib/source-sanity.mjs --selftest convention).

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

  // Build a healthy-shaped baseline free model, tweakable per-test.
  function makeFreeModel(i, overrides = {}) {
    return {
      id: `vendor/model-${i}:free`,
      name: `Model ${i} (free)`,
      context_length: 131072,
      architecture: { input_modalities: ["text"] },
      top_provider: { max_completion_tokens: 8192 },
      ...overrides,
    };
  }

  const healthyPaidPadding = Array.from({ length: 20 }, (_, i) => ({
    id: `vendor/paid-model-${i}`,
    name: `Paid Model ${i}`,
    context_length: 131072,
    architecture: { input_modalities: ["text"] },
    top_provider: { max_completion_tokens: 8192 },
  }));

  console.log("openrouter.mjs self-test");
  console.log("─".repeat(60));

  await test("throws when top-level JSON is an array, not an object", async () => {
    const msg = await runWithPayload([1, 2, 3]);
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/top-level JSON object/.test(msg), `unexpected message: ${msg}`);
  });

  await test('throws when "data" is renamed away (missing)', async () => {
    const msg = await runWithPayload({ models: [makeFreeModel(1)] });
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/"data" to be an array/.test(msg), `unexpected message: ${msg}`);
  });

  await test('throws when "data" is present but not an array', async () => {
    const msg = await runWithPayload({ data: { foo: "bar" } });
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/"data" to be an array/.test(msg), `unexpected message: ${msg}`);
  });

  await test('throws when "data" is an empty array (API looks empty/broken)', async () => {
    const msg = await runWithPayload({ data: [] });
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/0 model total/.test(msg), `unexpected message: ${msg}`);
  });

  await test("throws when the ':free' id suffix convention disappears across a healthy catalog", async () => {
    const noFreeSuffix = Array.from({ length: 30 }, (_, i) => ({
      id: `vendor/model-${i}-free`, // convention changed: no ':free' suffix anymore
      name: `Model ${i}`,
      context_length: 131072,
      architecture: { input_modalities: ["text"] },
    }));
    const msg = await runWithPayload({ data: noFreeSuffix });
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/suffix ":free"/.test(msg), `unexpected message: ${msg}`);
  });

  await test('throws when "context_length" is renamed to "contextWindow" across all :free models', async () => {
    const free = Array.from({ length: 10 }, (_, i) =>
      makeFreeModel(i, { context_length: undefined, contextWindow: 131072 }),
    );
    const msg = await runWithPayload({ data: [...free, ...healthyPaidPadding] });
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/context_length/.test(msg), `unexpected message: ${msg}`);
  });

  await test('throws when "architecture.input_modalities" nesting changes across all :free models', async () => {
    const free = Array.from({ length: 10 }, (_, i) =>
      makeFreeModel(i, { architecture: { modalities: ["text"] } }), // nesting/key changed
    );
    const msg = await runWithPayload({ data: [...free, ...healthyPaidPadding] });
    assert.ok(msg, "expected a throw, got none");
    assert.ok(/input_modalities/.test(msg), `unexpected message: ${msg}`);
  });

  await test("does NOT stringify a non-numeric context_length into garbage (single odd entry, not systemic)", async () => {
    const free = [
      makeFreeModel(0, { context_length: { tokens: 128000 } }), // type changed on one entry
      ...Array.from({ length: 9 }, (_, i) => makeFreeModel(i + 1)),
    ];
    const result = await (async () => {
      const realFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [...free, ...healthyPaidPadding] }),
      });
      try {
        return await fetchProviders();
      } finally {
        global.fetch = realFetch;
      }
    })();
    const weird = result[0].models.find((m) => m.id === "vendor/model-0:free");
    assert.strictEqual(weird.context, null, `expected null, got: ${JSON.stringify(weird.context)}`);
    assert.ok(
      !result[0].models.some((m) => m.context === "[object Object]"),
      "an object value leaked through as the literal string [object Object]",
    );
  });

  await test("healthy payload (normal shape) does not throw and keeps the strict :free filter", async () => {
    const free = Array.from({ length: 10 }, (_, i) => makeFreeModel(i));
    const msg = await runWithPayload({ data: [...free, ...healthyPaidPadding] });
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
