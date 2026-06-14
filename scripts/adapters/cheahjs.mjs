/**
 * Adapter: cheahjs/free-llm-api-resources
 * Source: https://raw.githubusercontent.com/cheahjs/free-llm-api-resources/main/README.md
 * Upstream license: none declared (all rights reserved) — we re-surface only the
 *   factual data (rate limits, context windows) with attribution + a link back.
 *
 * Parses the README markdown to extract free-tier LLM API providers.
 * Only ingests the "Free Providers" section — the "Providers with trial credits"
 * section is SKIPPED (those are paid credits, not permanently free rate-limited APIs).
 *
 * Source structure (two formats in the Free Providers section):
 *   FORMAT A — HTML table with Model Name / Model Limits columns:
 *     ### [Groq](https://console.groq.com)
 *     <table>...<tr><td>ModelName</td><td>250,000 tokens/minute<br>20 req/day</td></tr>...
 *
 *   FORMAT B — **Limits:** block + bullet list of models (no per-model limits):
 *     ### [OpenRouter](https://openrouter.ai)
 *     **Limits:** 20 requests/minute<br>50 requests/day
 *     - Model Name
 *     - Model Name 2
 *
 * Anti-hallucination: context=null, maxOutput=null, modality="" (not in source).
 * Rate limits only from what's literally present in the cell/block.
 */

import {
  canonicalSlug,
  slugify,
  safeUrl,
  cleanStr,
  SOURCES,
} from "../lib/normalize.mjs";

const README_URL =
  "https://raw.githubusercontent.com/cheahjs/free-llm-api-resources/main/README.md";

// ─── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchReadme() {
  const res = await fetch(README_URL);
  if (!res.ok)
    throw new Error(
      `cheahjs README fetch failed: ${res.status} ${res.statusText}`,
    );
  return res.text();
}

// ─── Heading extraction ────────────────────────────────────────────────────────

/**
 * Extract provider name and optional URL from a ### heading line.
 * Handles: `### [Name](url)`, `### Name`, `### Name (suffix)` etc.
 * Returns { name: string, url: string|null }
 */
function parseHeading(headingText) {
  // Strip the leading "### " prefix if present (already stripped by caller)
  // Match markdown link: [Name](url)
  const linkMatch = headingText.match(/^\[([^\]]+)\]\(([^)]+)\)/);
  if (linkMatch) {
    return {
      name: linkMatch[1].trim(),
      url: safeUrl(linkMatch[2].trim()),
    };
  }
  // Plain text heading (strip any trailing parenthetical notes)
  const plain = headingText.replace(/\s*\(.*?\)\s*$/, "").trim();
  return { name: plain, url: null };
}

/**
 * Derive a canonical provider name for slug purposes.
 * Strips platform/qualifier suffixes in parentheses that are part of the
 * brand name (e.g. "Mistral (La Plateforme)" → "Mistral",
 * "Mistral (Codestral)" → "Mistral Codestral" so it stays distinct).
 * The display name is kept as-is; only the slug-key is normalised.
 */
function slugName(displayName) {
  // Known qualifier → keep it as part of slug (distinct products)
  // Only strip generic platform qualifiers that are redundant
  return displayName
    .replace(/\s*\(\s*La\s+Plateforme\s*\)/i, "")  // "Mistral (La Plateforme)" → "Mistral"
    .trim();
}

// ─── HTML table parser (Format A) ─────────────────────────────────────────────

/**
 * Parse an HTML table string like:
 *   <table><thead><tr><th>Model Name</th><th>Model Limits</th></tr></thead><tbody>
 *   <tr><td>Groq Foo</td><td>1000 req/day<br>6000 tokens/min</td></tr>
 *   </tbody></table>
 * Returns Model[] with rateLimit filled from the limits cell.
 */
/** Guard: skip disclaimer/note text masquerading as model names. */
const NOTE_PATTERN =
  /^(currently|requires?|monthly|free tier|various|see |note:?|until |subject to|opting|paid|trial|subscription)/i;

/**
 * Guard: skip bullets that are generic section descriptors, not callable model ids.
 * Matches phrases like "Open and Proprietary Mistral models" — adjective-only
 * prefixes followed by a bare "models" suffix. Real model names always contain
 * a version token (number, dash-id, or slash) such as "mistral-7b", "llama-3.1",
 * "gpt-4o", "meta/llama-3", so they will NOT match this pattern.
 *
 * Rule: the bullet ends with the word "models" (plural) AND the entire string
 * contains no digit, no slash, and no dash — i.e. it is purely descriptive prose.
 *
 * Examples that WILL match (rejected — descriptors):
 *   "Open and Proprietary Mistral models"
 *   "Various open models"
 *
 * Examples that will NOT match (kept — real model names):
 *   "mistral-7b-instruct"     ← has dash
 *   "meta/llama-3.1-8b"      ← has slash + digit
 *   "Mistral Large"           ← no "models" suffix
 */
const GENERIC_MODELS_PATTERN = /\bmodels\s*$/i;

function parseHtmlTable(tableHtml) {
  const models = [];
  // Extract each <tr>...</tr> in tbody (rows with <td>)
  const rowRe = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let m;
  while ((m = rowRe.exec(tableHtml)) !== null) {
    const modelName = m[1]
      .replace(/<[^>]+>/g, "") // strip any inline tags
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    if (!modelName) continue;
    if (NOTE_PATTERN.test(modelName)) continue; // skip disclaimer rows
    if (GENERIC_MODELS_PATTERN.test(modelName) && !/[\d\-\/]/.test(modelName)) continue;

    // Replace <br> / <br /> with ", " and strip remaining tags
    const limitsRaw = m[2]
      .replace(/<br\s*\/?>/gi, ", ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const rateLimit = cleanStr(limitsRaw) || null;

    models.push({
      id: slugify(modelName),
      name: modelName,
      context: null,
      maxOutput: null,
      modality: "",
      rateLimit,
    });
  }
  return models;
}

// ─── Limits block parser (Format B) ───────────────────────────────────────────

/**
 * Extract a shared rate-limit string from a **Limits:** block.
 * Handles both inline markdown link and plain text:
 *   **Limits:** 20 requests/minute<br>50 requests/day
 *   **Limits:** [20 req/min<br>50 req/day](https://...)
 */
function parseLimitsBlock(limitsText) {
  if (!limitsText) return null;
  // Strip markdown link wrapper [text](url) → keep text
  let raw = limitsText.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Replace <br> with ", "
  raw = raw.replace(/<br\s*\/?>/gi, ", ").replace(/\s+/g, " ").trim();
  return cleanStr(raw);
}

/**
 * Extract bullet-list model names from a block of text.
 * Lines starting with "- " or "* ".
 */
function parseBulletModels(block, sharedRateLimit) {
  const models = [];
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ") && !trimmed.startsWith("* ")) continue;
    // Strip leading "- " or "* "
    let modelName = trimmed.slice(2).trim();
    // Strip markdown link: [Name](url) → Name
    modelName = modelName.replace(/^\[([^\]]+)\]\([^)]+\)/, "$1").trim();
    if (!modelName) continue;
    if (NOTE_PATTERN.test(modelName)) continue; // skip disclaimer/note bullets
    // Skip generic section descriptors ending in "models" with no version/id signal
    // (e.g. "Open and Proprietary Mistral models" — doc-link caption, not a real model).
    if (
      GENERIC_MODELS_PATTERN.test(modelName) &&
      !/[\d\-\/]/.test(modelName)
    ) continue;
    models.push({
      id: slugify(modelName),
      name: modelName,
      context: null,
      maxOutput: null,
      modality: "",
      rateLimit: sharedRateLimit,
    });
  }
  return models;
}

// ─── Section splitter ─────────────────────────────────────────────────────────

/**
 * Split README into named sections at the ## level.
 * Returns [{ heading: string, body: string }]
 */
function splitH2Sections(markdown) {
  const sections = [];
  const re = /^## (.+)$/gm;
  let lastIndex = 0;
  let lastHeading = "__preamble__";
  let m;
  while ((m = re.exec(markdown)) !== null) {
    sections.push({
      heading: lastHeading,
      body: markdown.slice(lastIndex, m.index),
    });
    lastHeading = m[1].trim();
    lastIndex = m.index + m[0].length;
  }
  sections.push({ heading: lastHeading, body: markdown.slice(lastIndex) });
  return sections;
}

/**
 * Split a section body into per-provider blocks at the ### level.
 * Returns [{ headingText: string, body: string }]
 */
function splitH3Blocks(sectionBody) {
  const blocks = [];
  const re = /^### (.+)$/gm;
  let lastIndex = 0;
  let lastHeading = null;
  let m;
  while ((m = re.exec(sectionBody)) !== null) {
    if (lastHeading !== null) {
      blocks.push({
        headingText: lastHeading,
        body: sectionBody.slice(lastIndex, m.index),
      });
    }
    lastHeading = m[1].trim();
    lastIndex = m.index + m[0].length;
  }
  if (lastHeading !== null) {
    blocks.push({
      headingText: lastHeading,
      body: sectionBody.slice(lastIndex),
    });
  }
  return blocks;
}

// ─── Per-provider parser ───────────────────────────────────────────────────────

function parseProviderBlock(headingText, body) {
  const { name, url } = parseHeading(headingText);
  if (!name) return null;

  let models = [];

  // FORMAT A: HTML table present → per-model limits
  const tableMatch = body.match(/<table[\s\S]*?<\/table>/i);
  if (tableMatch) {
    models = parseHtmlTable(tableMatch[0]);
  } else {
    // FORMAT B: **Limits:** block + optional bullet models
    // Extract **Limits:** line (may span multiple lines due to <br>)
    // Match: **Limits:**[optional linked text] up to end of that "paragraph"
    const limitsMatch = body.match(/\*\*Limits[^*]*\*\*[:\s]*([\s\S]*?)(?:\n\n|\n(?=[*#-]|$))/);
    let sharedRateLimit = null;
    if (limitsMatch) {
      sharedRateLimit = parseLimitsBlock(limitsMatch[1]);
    } else {
      // Fallback: try inline **Limits:** on a single line
      const inline = body.match(/\*\*Limits[^*]*\*\*[:\s]*(.+)/);
      if (inline) sharedRateLimit = parseLimitsBlock(inline[1]);
    }

    // Bullet models saja. Kalau ga ada model BERNAMA (cuma **Limits:** + link
    // generik "Various open models"), JANGAN bikin baris model sintetis —
    // anti-halusinasi: link generik bukan nama model. Lebih baik 0 model; provider
    // tetap ke-cover sumber lain (mnfst/freellm) via merge kalau emang ada.
    models = parseBulletModels(body, sharedRateLimit);
  }

  // Description: first non-blank prose line that is clearly descriptive.
  // Skip: headings, table markup, limits blocks, bullet lists, markdown links
  // with <br> (these are limits-as-links), generic "Models share…" boilerplate.
  let description = "";
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (/^[*#<|>!-]/.test(t)) continue;       // headings, tables, bullets, HTML
    if (/^\*\*Limits/i.test(t)) continue;       // **Limits:** block
    if (/^Models\s*share/i.test(t)) continue;   // OpenRouter boilerplate
    if (/<br/i.test(t)) continue;               // limits-as-link lines
    if (/^\[.*<br/.test(t)) continue;           // linked limits block
    if (/^Routes\s+to/i.test(t)) continue;      // Vercel AI Gateway generic
    description = t;
    break;
  }

  return {
    slug: canonicalSlug(slugName(name)),
    name,
    category: null,
    country: null,
    flag: null,
    url,
    baseUrl: null,
    description: cleanStr(description) || "",
    models,
    sourceUpdatedAt: null,
    moreModels: null,
    source: {
      ...SOURCES.cheahjs,
      syncedAt: new Date().toISOString(),
    },
  };
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function fetchProviders() {
  const markdown = await fetchReadme();

  // Split at ## level, find "Free Providers" section only
  const h2Sections = splitH2Sections(markdown);
  const freeSection = h2Sections.find(
    (s) =>
      s.heading.toLowerCase().includes("free providers") &&
      !s.heading.toLowerCase().includes("trial"),
  );
  if (!freeSection) {
    throw new Error(
      'cheahjs adapter: could not find "Free Providers" ## section in README',
    );
  }

  // Split free section into ### provider blocks
  const providerBlocks = splitH3Blocks(freeSection.body);

  const providers = [];
  for (const { headingText, body } of providerBlocks) {
    const provider = parseProviderBlock(headingText, body);
    if (provider) providers.push(provider);
  }

  return providers;
}
