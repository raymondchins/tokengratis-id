// Human-readable text rendering, shared by the CLI (with optional ANSI
// color) and the MCP server (always plain — the LLM reads this text).
//
// The project's #1 rule is aggregator-not-verifier: renderers here always
// carry provenance (sources[] + syncedAt) and NEVER emit the word
// "Verified" / "Terverifikasi".

import { noColor } from "./color.mjs";

/**
 * @param {import("./types.mjs").Provider[]} providers
 * @param {{ color?: typeof noColor }} [opts]
 */
export function formatProviderListText(providers, opts = {}) {
  const color = opts.color || noColor;
  if (providers.length === 0) return "Tidak ada provider yang cocok dengan filter ini.";
  return providers
    .map((p) => {
      const modalities = (p.modalities || []).join(", ") || "-";
      const ctx = p.maxContext || "-";
      return `${color.bold(p.name)} (${color.dim(p.slug)})  models=${p.modelCount}  context=${ctx}  modalities=${modalities}`;
    })
    .join("\n");
}

/**
 * @param {import("./types.mjs").Provider} p
 * @param {{ color?: typeof noColor }} [opts]
 */
export function formatProviderText(p, opts = {}) {
  const color = opts.color || noColor;
  const lines = [];
  lines.push(`${color.bold(p.name)} (${p.slug})`);
  if (p.category) lines.push(`Kategori: ${p.category}`);
  if (p.country) lines.push(`Negara (HQ): ${p.flag ? p.flag + " " : ""}${p.country}`);
  if (p.url) lines.push(`Halaman API key: ${p.url}`);
  if (p.baseUrl) lines.push(`Base URL: ${p.baseUrl}`);
  if (p.freeLimit) lines.push(`Free limit: ${p.freeLimit}`);
  if (p.description) lines.push(`Deskripsi (apa adanya dari sumber): ${p.description}`);
  if (p.moreModels) lines.push(`Catatan: ${p.moreModels}`);
  lines.push(`Modalitas: ${(p.modalities || []).join(", ") || "-"}`);
  lines.push(`Max context: ${p.maxContext || "-"}`);

  lines.push("");
  const models = p.models || [];
  lines.push(color.bold(`Models (${models.length}):`));
  if (models.length === 0) {
    lines.push("  (tidak ada model terstruktur dari sumber)");
  }
  for (const m of models) {
    const parts = [m.name || m.id];
    if (m.context) parts.push(`context=${m.context}`);
    if (m.maxOutput) parts.push(`maxOutput=${m.maxOutput}`);
    if (m.modality) parts.push(`modality=${m.modality}`);
    if (m.rateLimit) parts.push(`rateLimit=${m.rateLimit}`);
    lines.push(`  - ${parts.join("  ")}`);
  }

  lines.push("");
  lines.push(color.bold("Provenance (aggregator, bukan verifier):"));
  for (const s of p.sources || []) {
    lines.push(`  - ${s.name}: ${s.url} (synced ${s.syncedAt})`);
  }
  lines.push(`Synced: ${p.syncedAt}`);
  if (p.sourceUpdatedAt) lines.push(`Source last updated: ${p.sourceUpdatedAt}`);

  return lines.join("\n");
}

/**
 * @param {ReturnType<import("./filters.mjs").listModels>} rows
 * @param {{ color?: typeof noColor }} [opts]
 */
export function formatModelListText(rows, opts = {}) {
  const color = opts.color || noColor;
  if (rows.length === 0) return "Tidak ada model.";
  return rows
    .map((m) => {
      const parts = [`${color.bold(m.providerName)}/${m.name || m.id}`];
      if (m.context) parts.push(`context=${m.context}`);
      if (m.modality) parts.push(`modality=${m.modality}`);
      if (m.rateLimit) parts.push(`rateLimit=${m.rateLimit}`);
      return parts.join("  ");
    })
    .join("\n");
}

/**
 * @param {ReturnType<import("./filters.mjs").searchProviders>} results
 * @param {string} query
 * @param {{ color?: typeof noColor }} [opts]
 */
export function formatSearchResultsText(results, query, opts = {}) {
  const color = opts.color || noColor;
  if (results.length === 0) return `Tidak ada hasil untuk "${query}".`;
  const lines = [`Hasil pencarian untuk "${query}" — ${results.length} provider cocok:`, ""];
  for (const r of results) {
    const tag = r.matchedModels.length === 0 && r.providerMatch ? " (cocok nama provider)" : "";
    lines.push(`${color.bold(r.provider.name)} (${r.provider.slug})${tag}`);
    const shown = r.matchedModels.slice(0, 10);
    for (const m of shown) {
      lines.push(`  - ${m.name || m.id}`);
    }
    if (r.matchedModels.length > shown.length) {
      lines.push(`  ... +${r.matchedModels.length - shown.length} model lain`);
    }
  }
  return lines.join("\n");
}
