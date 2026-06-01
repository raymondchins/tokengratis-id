/**
 * Source adapter — freellm.net
 *
 * Scrapes https://freellm.net/models/ (server-rendered static HTML table).
 * No browser / JS execution needed — all data is in the raw HTML response.
 *
 * HTML structure (verified 2026-06-01, 170 rows, 27 providers):
 *   <tbody id="modelsBody">
 *     <tr data-provider="ProviderName" data-modality="text,vision" data-free="1" ...>
 *       <td> <a>ProviderName</a> </td>           col 0 — Provider
 *       <td> <a>ModelName</a> [badges] </td>     col 1 — Model
 *       <td class="mono">256K</td>               col 2 — Context
 *       <td class="mono hide-mobile">64K</td>    col 3 — Max Output
 *       <td> <span class="modality-tags">        col 4 — Modality (badges)
 *              <span class="badge">text</span>
 *              <span class="badge">vision</span>
 *            </span> </td>
 *       <td class="mono small">See provider page</td>  col 5 — Rate Limit
 *       <td class="mono small hide-mobile">Apr 1, 2026</td>  col 6 — Released
 *       <td class="mono small hide-mobile">1.7T</td>   col 7 — Weekly Tokens
 *       <td> <span class="status-badge">Online</span> </td>  col 8 — Status
 *       <td> <a class="btn">Details</a> </td>    col 9 — (ignored, UI only)
 *     </tr>
 *   </tbody>
 *
 * Modality: extracted from data-modality attribute on <tr> (comma-separated,
 * e.g. "text,vision") — cleaner than parsing inner badges.
 * Model name: extracted from <a class="model-link"> text.
 * Provider name: from data-provider attribute on <tr> (avoids parsing <a> href).
 *
 * NOTE: We include ALL rows (free + paid, data-free="0"|"1") because freellm.net
 * tracks which providers have free tiers — even rows marked paid are under a
 * provider that has other free models. The merge stage filters/annotates.
 *
 * Dependencies: NONE (plain Node https + regex, no cheerio).
 */

import { canonicalSlug, slugify, cleanStr, SOURCES } from "../lib/normalize.mjs";

const SOURCE_URL = "https://freellm.net/models/";

// ─── HTTP fetch with redirect-following ──────────────────────────────────────

function fetchHtml(url, depth = 0) {
  if (depth > 5) return Promise.reject(new Error("Too many redirects"));
  return new Promise((resolve, reject) => {
    // Dynamic import of https so the file is still pure ESM
    import("https").then(({ default: https }) => {
      const parsed = new URL(url);
      https.get(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; tokengratis-sync/1.0; +https://tokengratis.id)",
            Accept: "text/html,application/xhtml+xml",
          },
        },
        (res) => {
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            const loc = res.headers.location.startsWith("http")
              ? res.headers.location
              : parsed.origin + res.headers.location;
            res.resume();
            fetchHtml(loc, depth + 1).then(resolve).catch(reject);
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            return;
          }
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => resolve(body));
        }
      ).on("error", reject);
    });
  });
}

// ─── HTML entity decoder (basic, covers what freellm.net uses) ───────────────

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

// ─── Tag stripper ─────────────────────────────────────────────────────────────

/** Strip all HTML tags and decode entities, returning trimmed plain text. */
function textOf(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Row parser ───────────────────────────────────────────────────────────────

/**
 * Parse a single <tr>...</tr> string into a row object.
 * Uses data-* attributes on <tr> where available (faster + more reliable than
 * parsing inner cells for provider name and modality).
 */
function parseRow(trHtml) {
  // ── Pull data-* attrs from <tr> opening tag ───────────────────────────────
  const attrStr = trHtml.slice(0, trHtml.indexOf(">"));

  const providerAttr = (attrStr.match(/data-provider="([^"]*)"/) || [])[1] || "";
  const modalityAttr = (attrStr.match(/data-modality="([^"]*)"/) || [])[1] || "";

  if (!providerAttr) return null; // skip non-data rows (e.g. thead artefacts)

  // ── Extract <td> cells ────────────────────────────────────────────────────
  // Match <td ...>...</td> — greedy within cell is fine since we process one <tr>
  const tdRe = /<td(?:\s[^>]*)?>[\s\S]*?<\/td>/g;
  const cells = [];
  let m;
  while ((m = tdRe.exec(trHtml)) !== null) {
    cells.push(m[0]);
  }

  // col indices: 0=Provider 1=Model 2=Context 3=MaxOutput 4=Modality
  //              5=RateLimit 6=Released 7=WeeklyTokens 8=Status 9=Details(skip)

  // ── Model name: prefer <a class="model-link"> text ────────────────────────
  let modelName = "";
  if (cells[1]) {
    const linkM = cells[1].match(/<a[^>]+class="model-link"[^>]*>([\s\S]*?)<\/a>/);
    if (linkM) {
      modelName = textOf(linkM[1]);
    } else {
      // fallback: first <a> text in cell
      const anyLink = cells[1].match(/<a[^>]*>([\s\S]*?)<\/a>/);
      modelName = anyLink ? textOf(anyLink[1]) : textOf(cells[1]);
    }
  }

  if (!modelName) return null; // skip rows without a model name

  // ── Context ───────────────────────────────────────────────────────────────
  const contextRaw = cells[2] ? textOf(cells[2]) : "";
  const context = cleanStr(contextRaw);

  // ── Max Output ────────────────────────────────────────────────────────────
  const maxOutputRaw = cells[3] ? textOf(cells[3]) : "";
  const maxOutput = cleanStr(maxOutputRaw);

  // ── Modality: use data-modality attr, join badges with " + " for readability
  // data-modality is comma-separated e.g. "text,vision" — map to display string
  const modality = modalityAttr
    ? modalityAttr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" + ")
    : "";

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rateLimitRaw = cells[5] ? textOf(cells[5]) : "";
  // Explicitly null out "See provider page" (case-insensitive) BEFORE cleanStr
  const rateLimit =
    /^see\s+provider\s+page$/i.test(rateLimitRaw.trim())
      ? null
      : cleanStr(rateLimitRaw);

  return {
    providerName: providerAttr,
    modelName,
    context,
    maxOutput,
    modality,
    rateLimit,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch https://freellm.net/models/, parse the static HTML table, and return
 * one ProviderPartial per provider with all its models nested.
 *
 * @returns {Promise<import('../lib/normalize.mjs').ProviderPartial[]>}
 */
export async function fetchProviders() {
  const html = await fetchHtml(SOURCE_URL);

  // Isolate <tbody> to avoid false matches in <thead> or scripts
  const tbodyStart = html.indexOf("<tbody");
  const tbodyEnd = html.lastIndexOf("</tbody>");
  if (tbodyStart === -1 || tbodyEnd === -1) {
    throw new Error("freellm.mjs: could not locate <tbody> in response");
  }
  const tbody = html.slice(tbodyStart, tbodyEnd + 8);

  // Match every <tr ...>...</tr> block
  const trRe = /<tr\s[\s\S]*?<\/tr>/g;
  const rowsByProvider = new Map(); // providerName -> { name, models[] }

  let trMatch;
  while ((trMatch = trRe.exec(tbody)) !== null) {
    const row = parseRow(trMatch[0]);
    if (!row) continue;

    const { providerName, modelName, context, maxOutput, modality, rateLimit } =
      row;

    if (!rowsByProvider.has(providerName)) {
      rowsByProvider.set(providerName, {
        name: providerName,
        models: [],
      });
    }

    rowsByProvider.get(providerName).models.push({
      id: slugify(modelName),
      name: modelName,
      context,
      maxOutput,
      modality: modality || "",
      rateLimit,
    });
  }

  const syncedAt = new Date().toISOString();

  // Build ProviderPartial array
  const providers = [];
  for (const [, { name, models }] of rowsByProvider) {
    providers.push({
      slug: canonicalSlug(name),
      name,
      category: null,
      country: null,
      flag: null,
      url: null,
      baseUrl: null,
      description: "",
      models,
      sourceUpdatedAt: null,
      moreModels: null,
      source: {
        ...SOURCES.freellm,
        syncedAt,
      },
    });
  }

  return providers;
}
