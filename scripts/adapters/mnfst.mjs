// Adapter: mnfst/awesome-free-llm-apis
// Fetches https://raw.githubusercontent.com/mnfst/awesome-free-llm-apis/main/data.json
// and normalises to ProviderPartial[].
//
// Contract: export async function fetchProviders() → ProviderPartial[]
// (see scripts/lib/normalize.mjs for shape + helper docs)
//
// Do NOT add domain/logo/modalities/modelCount/maxContext/freeLimit here —
// those are computed at merge stage.

import { canonicalSlug, safeUrl, cleanStr, SOURCES } from "../lib/normalize.mjs";

const SRC_URL =
  "https://raw.githubusercontent.com/mnfst/awesome-free-llm-apis/main/data.json";

/**
 * Fetch and normalise providers from mnfst/awesome-free-llm-apis.
 * @returns {Promise<import('../lib/normalize.mjs').ProviderPartial[]>}
 */
export async function fetchProviders() {
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`mnfst fetch failed: ${res.status}`);
  const data = await res.json();

  const syncedAt = new Date().toISOString();
  const sourceUpdatedAt = data.lastUpdated || null;

  return data.providers.map((p) => {
    const allModels = (p.models || []).map((m) => ({
      id: m.id,
      name: m.name,
      context: cleanStr(m.context),
      maxOutput: cleanStr(m.maxOutput),
      modality: m.modality,
      rateLimit: cleanStr(m.rateLimit),
    }));

    // Sumber kadang nyelipin baris "catatan" (id null), mis. "+ 42 more models".
    // Pisahin: real models = truthy id. Note text disimpan di moreModels (extra
    // field — merge stage reads it) dan di-append ke description sebagai fallback.
    const models = allModels.filter((m) => m.id);
    const moreEntry = allModels.find((m) => !m.id);
    const moreModels = moreEntry
      ? moreEntry.name.replace(/^\+\s*/, "").trim()
      : null;

    return {
      slug: canonicalSlug(p.name),
      name: p.name,
      category: p.category || null,
      country: p.country || null,
      flag: p.flag || null,
      url: safeUrl(p.url),
      baseUrl: safeUrl(p.baseUrl),
      description: p.description || "",
      models,
      moreModels,
      sourceUpdatedAt,
      source: { ...SOURCES.mnfst, syncedAt },
    };
  });
}
