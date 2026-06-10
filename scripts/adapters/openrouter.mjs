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

import { safeUrl, cleanStr, cleanModality } from "../lib/normalize.mjs";

const API_URL = "https://openrouter.ai/api/v1/models";

// SourceRef untuk provenance — URL = endpoint yang di-fetch (sumber langsung).
const SOURCE_REF = {
  name: "openrouter.ai/api/v1/models",
  url: API_URL,
};

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
 * Anti-halusinasi: kalau array kosong atau null → null (jangan nebak "text").
 * @param {string[]|null|undefined} inputModalities
 * @returns {string|null}
 */
function deriveModality(inputModalities) {
  if (!inputModalities || inputModalities.length === 0) return null;
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
  const syncedAt = new Date().toISOString();

  // Filter ketat: hanya id yang berakhiran ':free'
  const freeModels = (data.data || []).filter((m) =>
    typeof m.id === "string" && m.id.endsWith(":free"),
  );

  const models = freeModels.map((m) => {
    const ctxTokens = m.context_length || null;
    // max_completion_tokens dari top_provider — hanya kalau ada & truthy
    const maxOutputTokens =
      m.top_provider?.max_completion_tokens || null;

    return {
      // Pertahankan full id termasuk ':free' — itu yang dipanggil user ke API
      id: m.id,
      name: cleanStr(m.name) ?? m.id,
      context: fmtContext(ctxTokens),
      // maxOutput: hanya dari top_provider.max_completion_tokens (ada di sumber)
      maxOutput: fmtContext(maxOutputTokens),
      modality: cleanModality(deriveModality(m.architecture?.input_modalities)),
      // rateLimit: OpenRouter /api/v1/models tidak ekspos ini → null (anti-halusinasi)
      rateLimit: null,
    };
  });

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
