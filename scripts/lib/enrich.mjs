/**
 * scripts/lib/enrich.mjs — Post-merge enrichment dari models.dev.
 *
 * TUJUAN: gap-fill field `context` dan `maxOutput` model yang null/undefined
 * SETELAH merge dari sumber-sumber free-tier (mnfst/freellm/cheahjs). models.dev
 * BUKAN sumber free-tier — dia nyediain metadata teknis (context window, output
 * limit) yang sering absen di sumber komunitas kita.
 *
 * ANTI-HALUSINASI (non-negotiable):
 *   - HANYA fill field yang null/undefined. JANGAN overwrite nilai yang sudah ada.
 *   - HANYA fill dengan exact key match. JANGAN infer/nebak/interpolasi.
 *   - Kalau satu key match ke >1 entry models.dev dengan context BERBEDA → skip
 *     (ambiguous — lebih baik null daripada angka salah).
 *   - Best-effort: fetch/parse error → return providers asli UTUH, tanpa throw.
 *
 * Dipanggil di scripts/sync.mjs SETELAH mergeProviders(), SEBELUM smoke tests
 * supaya data yang di-validate = data yang di-enrich.
 *
 * Export:
 *   enrichFromModelsDev(providers) → { providers, enrichedCount, touched }
 *   buildModelsDevIndex(rawData)   → Map<string, { context, output }> (testable)
 *   enrichProviders(providers, idx) → { providers, enrichedCount, touched } (testable)
 */

// ─── Konstanta ────────────────────────────────────────────────────────────────

const MODELS_DEV_URL = "https://models.dev/api.json";
const SOURCE_NAME    = "models.dev";
const SOURCE_URL     = "https://models.dev";

// ─── Format helpers ───────────────────────────────────────────────────────────

/**
 * Konversi angka token (integer) ke display string ringkas yang konsisten
 * dengan format sumber lain di pipeline (mis. "128K", "1M", "32K").
 * models.dev nyimpen token sebagai angka integer (32768, 131072, dll).
 *
 * Pembulatan HANYA kalau tidak ada informasi yang hilang:
 *   32768  → "32K"     (32768 / 1024 = 32 exact)
 *   131072 → "128K"    (131072 / 1024 = 128 exact)
 *   1048576 → "1M"     (exact)
 *   200000 → "200K"    (bukan 0.19M — tetap K sampai >= 1M exact)
 * Kalau ada sisa (non-round), tetap pakai angka apa adanya sebagai string.
 */
function fmtTokens(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000 && n % 1_000_000 === 0) return `${n / 1_000_000}M`;
  if (n >= 1_000 && n % 1_000 === 0) return `${n / 1_000}K`;
  // fallback: cek pembulatan "nice" KiB (1024-based — banyak provider pakai ini)
  if (n >= 1_048_576 && n % 1_048_576 === 0) return `${n / 1_048_576}M`;
  if (n >= 1_024 && n % 1_024 === 0) return `${n / 1_024}K`;
  // angka tidak bulat: tetap apa adanya
  return String(n);
}

// ─── Normalisasi key ──────────────────────────────────────────────────────────

/**
 * Normalisasi model id/name ke lookup key: lowercase, trim, strip @-prefix,
 * strip :free suffix, strip leading "vendor/" prefix (satu level).
 * Dipakai buat indexing DAN candidate generation — HARUS konsisten.
 */
function normKey(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/^@/, "")           // "@cf/..." → "cf/..."
    .replace(/:free$/, "")       // "model:free" → "model"
    .replace(/^[^/]+\//, "");    // strip ONE leading "vendor/" segment
}

/**
 * Generate semua candidate lookup keys dari satu model.
 * Urutan: exact id → id tanpa :free → id tanpa vendor/ prefix → name variants.
 * Setiap kandidat sudah di-normalize (lowercase, trim, dll).
 * Returns array unik (Set-deduped), bisa kosong.
 */
function candidateKeys(model) {
  const seen = new Set();
  const add = (v) => {
    const k = normKey(v);
    if (k) seen.add(k);
  };

  const id   = model.id   || "";
  const name = model.name || "";

  // Dari id: exact, tanpa :free, tanpa vendor prefix, tanpa kedua-duanya
  add(id);
  add(id.replace(/:free$/i, ""));
  add(id.replace(/^[^/]+\//, ""));
  add(id.replace(/^[^/]+\//, "").replace(/:free$/i, ""));

  // Dari name kalau berbeda dari id (beberapa sumber nyimpen id sama name)
  if (name.toLowerCase() !== id.toLowerCase()) {
    add(name);
    add(name.replace(/:free$/i, ""));
    add(name.replace(/^[^/]+\//, ""));
  }

  return [...seen];
}

// ─── Index builder (pure, testable) ──────────────────────────────────────────

/**
 * Bangun flat lookup index dari raw models.dev api.json.
 *
 * models.dev structure:
 *   { [providerKey]: { models: { [modelKey]: { limit: { context: number, output: number }, ... } } } }
 *
 * Output: Map<normalizedKey, { context: string|null, output: string|null }>
 *
 * Collision policy (ANTI-HALUSINASI):
 *   - Kalau dua entry models.dev share normalized key tapi punya context BERBEDA
 *     → simpan null untuk field itu (ambiguous, jangan nebak).
 *   - Kalau sama → simpan apa adanya.
 *
 * @param {Object} rawData  Parsed api.json (plain JS object)
 * @returns {Map<string, { context: string|null, output: string|null }>}
 */
export function buildModelsDevIndex(rawData) {
  // sentinel value untuk "ada tapi conflicting" — dibedakan dari null = "tidak ada"
  const CONFLICT = Symbol("conflict");

  // intermediate: Map<key, { context: number|CONFLICT, output: number|CONFLICT }>
  const raw = new Map();

  for (const providerVal of Object.values(rawData)) {
    const models = providerVal?.models;
    if (!models || typeof models !== "object") continue;

    for (const [modelKey, modelVal] of Object.entries(models)) {
      const limit = modelVal?.limit;
      if (!limit) continue;

      const ctx = typeof limit.context === "number" ? limit.context : null;
      const out = typeof limit.output  === "number" ? limit.output  : null;

      const nk = normKey(modelKey);
      if (!nk) continue;

      if (!raw.has(nk)) {
        raw.set(nk, { context: ctx, output: out });
      } else {
        const existing = raw.get(nk);
        // Collision: kalau nilai berbeda → tandai CONFLICT (anti-halusinasi)
        if (existing.context !== ctx) existing.context = CONFLICT;
        if (existing.output  !== out) existing.output  = CONFLICT;
      }
    }
  }

  // Konversi ke final index: number → formatted string, CONFLICT → null
  const idx = new Map();
  for (const [k, v] of raw) {
    idx.set(k, {
      context: v.context === CONFLICT ? null : fmtTokens(v.context),
      output:  v.output  === CONFLICT ? null : fmtTokens(v.output),
    });
  }

  return idx;
}

// ─── Enrichment logic (pure, testable) ───────────────────────────────────────

/**
 * Gap-fill models di setiap provider menggunakan index dari buildModelsDevIndex().
 *
 * Aturan:
 *   - Cuma fill field yang null/undefined (JANGAN overwrite nilai existing).
 *   - Match = salah satu candidateKeys(model) exact-match di idx.
 *   - Kalau >1 candidate match tapi hasilnya sama → OK (konsisten).
 *   - Kalau >1 candidate match dengan nilai BERBEDA → skip (ambiguous).
 *   - Provider yang dapat >=1 fill: append SourceRef models.dev ke sources[].
 *   - Modifikasi in-place (tapi return object sama — caller tetap pakai return value).
 *
 * @param {Array<Object>} providers  Canonical Provider[] dari mergeProviders()
 * @param {Map}           idx        Output buildModelsDevIndex()
 * @param {string}        syncedAt   ISO timestamp (buat SourceRef.syncedAt)
 * @returns {{ providers: Array<Object>, enrichedCount: number, touched: string[] }}
 */
export function enrichProviders(providers, idx, syncedAt) {
  let enrichedCount = 0;
  const touched = [];

  for (const provider of providers) {
    let providerGotFill = false;

    for (const model of provider.models || []) {
      const needsCtx = model.context   == null;
      const needsOut = model.maxOutput == null;
      if (!needsCtx && !needsOut) continue; // model sudah lengkap — skip

      // Cari semua candidate keys, cek mana yang ada di index
      const candidates = candidateKeys(model);
      const matches = candidates
        .map((k) => idx.get(k))
        .filter(Boolean);

      if (matches.length === 0) continue; // tidak ada data di models.dev

      // Resolve nilai yang akan di-fill — harus konsisten antar semua matches
      let resolvedCtx = null;
      let resolvedOut = null;
      let ctxConflict = false;
      let outConflict = false;

      for (const m of matches) {
        // context
        if (m.context != null) {
          if (resolvedCtx === null) {
            resolvedCtx = m.context;
          } else if (resolvedCtx !== m.context) {
            ctxConflict = true;
          }
        }
        // output
        if (m.output != null) {
          if (resolvedOut === null) {
            resolvedOut = m.output;
          } else if (resolvedOut !== m.output) {
            outConflict = true;
          }
        }
      }

      // Fill — HANYA kalau tidak ambiguous
      if (needsCtx && !ctxConflict && resolvedCtx != null) {
        model.context = resolvedCtx;
        enrichedCount++;
        providerGotFill = true;
      }
      if (needsOut && !outConflict && resolvedOut != null) {
        model.maxOutput = resolvedOut;
        enrichedCount++;
        providerGotFill = true;
      }
    }

    // Append SourceRef models.dev ke provider.sources (tanpa duplikat)
    if (providerGotFill) {
      touched.push(provider.slug);
      const alreadyHasSource = (provider.sources || []).some(
        (s) => s.name === SOURCE_NAME,
      );
      if (!alreadyHasSource) {
        provider.sources = [
          ...(provider.sources || []),
          { name: SOURCE_NAME, url: SOURCE_URL, syncedAt },
        ];
      }
    }
  }

  return { providers, enrichedCount, touched };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch models.dev api.json, bangun index, lalu gap-fill providers.
 *
 * Best-effort: SETIAP error (network, parse, runtime) → return providers UTUH
 * tanpa throw. Enrichment = nice-to-have, bukan blocker pipeline.
 *
 * @param {Array<Object>} providers  Canonical Provider[] dari mergeProviders()
 * @returns {Promise<{ providers: Array<Object>, enrichedCount: number, touched: string[] }>}
 */
export async function enrichFromModelsDev(providers) {
  const syncedAt = new Date().toISOString();

  let rawData;
  try {
    const res = await fetch(MODELS_DEV_URL, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rawData = await res.json();
  } catch (err) {
    // Fetch/parse gagal — skip enrichment, jangan jatohin pipeline
    console.error(`[enrich] models.dev fetch gagal: ${err.message} — dilewati`);
    return { providers, enrichedCount: 0, touched: [] };
  }

  let idx;
  try {
    idx = buildModelsDevIndex(rawData);
  } catch (err) {
    console.error(`[enrich] models.dev index build gagal: ${err.message} — dilewati`);
    return { providers, enrichedCount: 0, touched: [] };
  }

  let result;
  try {
    result = enrichProviders(providers, idx, syncedAt);
  } catch (err) {
    console.error(`[enrich] enrichment gagal: ${err.message} — dilewati`);
    return { providers, enrichedCount: 0, touched: [] };
  }

  console.log(
    `[enrich] models.dev: +${result.enrichedCount} field filled di ${result.touched.length} provider (${result.touched.join(", ") || "-"})`,
  );

  return result;
}

// ─── Self-test (run dengan: node scripts/lib/enrich.mjs) ─────────────────────

if (
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("scripts/lib/enrich.mjs")
) {
  console.log("\n=== UNIT TEST (tanpa network) ===\n");

  // Fake models.dev data (injected — no network)
  const fakeRaw = {
    "groq": {
      models: {
        "llama-3.3-70b-versatile": { limit: { context: 131072,  output: 32768 } },
        "llama3-8b-8192":          { limit: { context: 8192,    output: 8192  } },
        "whisper-large-v3":        { limit: { context: 448000,  output: 448000 } },
      },
    },
    "openrouter": {
      models: {
        // same key as groq:llama3 but different context → CONFLICT
        "llama3-8b-8192": { limit: { context: 9999, output: 8192 } },
      },
    },
    "mistral": {
      models: {
        "mistral-small-latest": { limit: { context: 32768, output: 4096 } },
      },
    },
  };

  const idx = buildModelsDevIndex(fakeRaw);
  console.log("Index size:", idx.size);

  // Verify conflict detection: llama3-8b-8192 context should be null (conflict)
  const conflictEntry = idx.get("llama3-8b-8192");
  const conflictOk = conflictEntry && conflictEntry.context === null && conflictEntry.output === "8K";
  console.log(`(a) conflict detection: context=null output="8K" → ${conflictOk ? "PASS" : "FAIL"}`);
  console.log("    actual:", JSON.stringify(conflictEntry));

  // Verify clean entry
  const cleanEntry = idx.get("llama-3.3-70b-versatile");
  const cleanOk = cleanEntry?.context === "128K" && cleanEntry?.output === "32K";
  console.log(`(b) clean entry llama-3.3-70b-versatile: context="128K" output="32K" → ${cleanOk ? "PASS" : "FAIL"}`);
  console.log("    actual:", JSON.stringify(cleanEntry));

  // Fake providers
  const fakeProviders = [
    {
      slug: "groq",
      models: [
        // model yang bisa di-fill (context null, maxOutput null)
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", context: null, maxOutput: null, modality: "Text", rateLimit: "200 RPM" },
        // model context conflict → context tidak di-fill, maxOutput di-fill
        { id: "llama3-8b-8192", name: "Llama3 8B", context: null, maxOutput: null, modality: "Text", rateLimit: null },
        // model sudah punya context → JANGAN overwrite
        { id: "whisper-large-v3", name: "Whisper Large v3", context: "448K", maxOutput: null, modality: "Audio", rateLimit: null },
      ],
      sources: [{ name: "mnfst/awesome-free-llm-apis", url: "https://github.com", syncedAt: "2026-06-10T00:00:00Z" }],
    },
    {
      slug: "nothing-provider",
      models: [
        // id yang sama sekali tidak ada di index
        { id: "totally-unknown-model-xyz", name: "Unknown", context: null, maxOutput: null, modality: null, rateLimit: null },
      ],
      sources: [{ name: "mnfst/awesome-free-llm-apis", url: "https://github.com", syncedAt: "2026-06-10T00:00:00Z" }],
    },
  ];

  const syncAt = "2026-06-10T12:00:00.000Z";
  const { providers: enriched, enrichedCount, touched } = enrichProviders(fakeProviders, idx, syncAt);

  console.log("\n--- enrichProviders results ---");
  console.log("enrichedCount:", enrichedCount);
  console.log("touched:", touched);

  const groq = enriched.find(p => p.slug === "groq");
  const llama70b = groq.models.find(m => m.id === "llama-3.3-70b-versatile");
  const llama8b  = groq.models.find(m => m.id === "llama3-8b-8192");
  const whisper  = groq.models.find(m => m.id === "whisper-large-v3");

  // (c) llama 70b filled both
  const c = llama70b.context === "128K" && llama70b.maxOutput === "32K";
  console.log(`(c) llama-3.3-70b fill both: context="128K" maxOutput="32K" → ${c ? "PASS" : "FAIL"}`);
  console.log("    actual:", JSON.stringify({ context: llama70b.context, maxOutput: llama70b.maxOutput }));

  // (d) llama8b conflict: context still null, maxOutput filled ("8K")
  const d = llama8b.context === null && llama8b.maxOutput === "8K";
  console.log(`(d) llama3-8b conflict: context=null maxOutput="8K" → ${d ? "PASS" : "FAIL"}`);
  console.log("    actual:", JSON.stringify({ context: llama8b.context, maxOutput: llama8b.maxOutput }));

  // (e) whisper context NOT overwritten
  const e = whisper.context === "448K";
  console.log(`(e) whisper existing context preserved: "448K" → ${e ? "PASS" : "FAIL"}`);

  // (f) groq.sources has models.dev appended
  const f = groq.sources.some(s => s.name === SOURCE_NAME);
  console.log(`(f) groq.sources includes models.dev → ${f ? "PASS" : "FAIL"}`);

  // (g) nothing-provider NOT in touched (no fills)
  const g = !touched.includes("nothing-provider");
  console.log(`(g) nothing-provider NOT in touched → ${g ? "PASS" : "FAIL"}`);

  // (h) models.dev source NOT added to nothing-provider
  const np = enriched.find(p => p.slug === "nothing-provider");
  const h = !np.sources.some(s => s.name === SOURCE_NAME);
  console.log(`(h) nothing-provider sources unchanged → ${h ? "PASS" : "FAIL"}`);

  console.log("\n=== LIVE TEST (network) ===\n");
  const { enrichedCount: liveCount, touched: liveTouched } = await enrichFromModelsDev(fakeProviders.map(p => ({
    ...p,
    // Reset untuk live test
    models: p.models.map(m => ({ ...m, context: null, maxOutput: null })),
    sources: [{ name: "mnfst/awesome-free-llm-apis", url: "https://github.com", syncedAt: "2026-06-10T00:00:00Z" }],
  })));
  console.log("Live enrichedCount:", liveCount);
  console.log("Live touched:", liveTouched);
  console.log(liveCount > 0 ? "PASS (ada fills dari live api.json)" : "WARN (0 fills — cek koneksi atau model ID berubah)");
}
