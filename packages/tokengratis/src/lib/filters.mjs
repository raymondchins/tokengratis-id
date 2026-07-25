// Filtering / searching helpers shared by the CLI and the MCP server.
// Pure functions only — no I/O here.

/**
 * Parse a human-readable context-window string ("128K", "1M", "32000")
 * into a plain token count. Returns null when it can't be parsed.
 * @param {string | null | undefined} value
 * @returns {number | null}
 */
export function parseContextTokens(value) {
  if (!value) return null;
  const match = String(value).trim().toUpperCase().match(/^([\d.]+)\s*([KM])?$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (Number.isNaN(num)) return null;
  const mult = match[2] === "M" ? 1_000_000 : match[2] === "K" ? 1_000 : 1;
  return num * mult;
}

/**
 * @param {import("./types.mjs").Provider[]} providers
 * @param {string | undefined} modality
 */
export function filterByModality(providers, modality) {
  if (!modality) return providers;
  const target = modality.trim().toLowerCase();
  return providers.filter((p) =>
    (p.modalities || []).some((m) => String(m).toLowerCase() === target)
  );
}

/**
 * @param {import("./types.mjs").Provider[]} providers
 * @param {string | undefined} minContext
 */
export function filterByMinContext(providers, minContext) {
  const threshold = parseContextTokens(minContext);
  if (threshold == null) return providers;
  return providers.filter((p) => {
    const value = parseContextTokens(p.maxContext);
    return value != null && value >= threshold;
  });
}

/**
 * Match provider names/slugs and model names/ids against a query substring.
 * @param {import("./types.mjs").Provider[]} providers
 * @param {string} query
 * @returns {{ provider: import("./types.mjs").Provider, matchedModels: import("./types.mjs").Model[], providerMatch: boolean }[]}
 */
export function searchProviders(providers, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  for (const p of providers) {
    const providerMatch =
      (p.name || "").toLowerCase().includes(q) || (p.slug || "").toLowerCase().includes(q);
    const matchedModels = (p.models || []).filter(
      (m) =>
        (m.name || "").toLowerCase().includes(q) || (m.id || "").toLowerCase().includes(q)
    );
    if (providerMatch || matchedModels.length > 0) {
      results.push({ provider: p, matchedModels, providerMatch });
    }
  }
  return results;
}

/**
 * Flatten providers -> models, optionally scoped to one provider slug.
 * @param {import("./types.mjs").Provider[]} providers
 * @param {string | undefined} providerSlug
 */
export function listModels(providers, providerSlug) {
  const scoped = providerSlug
    ? providers.filter((p) => p.slug === providerSlug)
    : providers;
  const rows = [];
  for (const p of scoped) {
    for (const m of p.models || []) {
      rows.push({ provider: p.slug, providerName: p.name, ...m });
    }
  }
  return rows;
}
