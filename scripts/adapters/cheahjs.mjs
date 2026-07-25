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
 *
 * FORMAT A KOLOM DI-MAP BY NAMA HEADER, BUKAN BY INDEKS TD. See freellm.mjs's
 * top-of-file comment (INCIDENT 2026-07-25) for the full story: that adapter
 * hard-coded column indices for an HTML table, freellm.net silently reordered
 * its columns, and 216/398 models got wrong data for weeks — count-based
 * guards (sanity floor, diff guard, smoke test) all passed because row/column
 * COUNT stayed the same, only column MEANING changed.
 *
 * cheahjs.mjs's Format A used to have the exact same shape of risk: the old
 * `parseHtmlTable` assumed td #1 = model name, td #2 = limits, unconditionally.
 * If upstream ever reordered `<th>Model Name</th><th>Model Limits</th>` to the
 * opposite order (or inserted a column between them), the parse would still
 * "succeed" but rate-limit text would land in `name` and vice versa — wrong
 * data that looks normal, exactly the failure class from the freellm incident.
 * Fixed the same way: `parseTableHeaderMap()` reads the `<thead>` row, resolves
 * `name`/`limits` by normalised header label (with aliases), and THROWS if the
 * model-name column can't be found — never guesses a fallback index. A column
 * that's legitimately absent (e.g. no limits column at all) becomes `null`,
 * never backfilled from a neighbouring cell.
 *
 * Format B (the `**Limits:**` block + bullet list) was never positional to
 * begin with — it's already located by a literal `**Limits**` text marker and
 * markdown bullet syntax (`- `/`* `), not by column index — so it doesn't
 * share this failure mode. Left as-is.
 */

import {
  canonicalSlug,
  slugify,
  safeUrl,
  cleanStr,
  SOURCES,
  decodeEntities,
  GENERIC_MODELS_PATTERN,
} from "../lib/normalize.mjs";

const README_URL =
  "https://raw.githubusercontent.com/cheahjs/free-llm-api-resources/main/README.md";

// ─── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchReadme() {
  const res = await fetch(README_URL, { signal: AbortSignal.timeout(15_000) });
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

// GENERIC_MODELS_PATTERN (guard against section-descriptor rows like "Open and
// Proprietary Mistral models") lives in scripts/lib/normalize.mjs — shared with
// sync.mjs's smoke test (was duplicated as META_MODEL_PATTERN there).

/** Normalisasi label header jadi key: "Model Limits" -> "modellimits". */
function headerKey(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Baca <thead> sebuah tabel Format A dan petakan nama kolom -> indeks <td>.
 *
 * Jantung fix-nya: kalau upstream geser/tuker urutan `<th>` (mis. "Model
 * Limits" duluan baru "Model Name") atau nyisipin kolom baru di antaranya,
 * mapping ikut sendiri karena di-resolve by NAMA header, bukan posisi. Kalau
 * kolom nama-model — yang kita ANDALKAN buat identitas tiap baris — ga
 * ketemu, throw. Sengaja gagal berisik: sync yang skip source ini semalam
 * jauh lebih murah daripada rate-limit text nyasar ke field `name` (atau
 * sebaliknya) dan lolos diam-diam ke production (lihat pola INCIDENT
 * 2026-07-25 di freellm.mjs, komentar atas file ini).
 *
 * @returns {{ name: number, limits: number|null }}
 */
function parseTableHeaderMap(tableHtml) {
  const theadM = tableHtml.match(/<thead[\s>][\s\S]*?<\/thead>/i);
  if (!theadM) {
    throw new Error(
      "cheahjs.mjs: <thead> ga ketemu di tabel HTML — struktur berubah total, " +
        "JANGAN tebak indeks kolom (pola sama dengan INCIDENT 2026-07-25 di freellm.mjs)",
    );
  }
  const labels = (theadM[0].match(/<th(?:\s[^>]*)?>[\s\S]*?<\/th>/gi) || []).map(
    (c) => headerKey(decodeEntities(c.replace(/<[^>]+>/g, ""))),
  );
  if (!labels.length) {
    throw new Error("cheahjs.mjs: <thead> ada tapi nol <th> — struktur tabel berubah");
  }

  const idx = (...aliases) => {
    for (const a of aliases) {
      const i = labels.indexOf(a);
      if (i !== -1) return i;
    }
    return null;
  };

  const name = idx("modelname", "model", "models", "name");
  if (name === null) {
    throw new Error(
      `cheahjs.mjs: kolom nama model ga ada di header tabel [${labels.join(", ")}] — ` +
        `JANGAN tebak indeks, benerin mapping-nya dulu (pola sama dengan INCIDENT 2026-07-25 di freellm.mjs)`,
    );
  }

  return {
    name,
    // Opsional secara struktural — kalau upstream ngilangin kolom ini, rateLimit
    // tetap null (data emang ga ada), BUKAN diambil dari kolom tetangga.
    limits: idx("modellimits", "limits", "ratelimit", "limit", "rate"),
  };
}

function parseHtmlTable(tableHtml) {
  const col = parseTableHeaderMap(tableHtml);

  // Batasi scan ke <tbody> kalau ada, biar row header (<th>, bukan <td>) ga
  // ikut ke-loop. Dalam praktiknya regex <td> di bawah udah otomatis skip row
  // header (dia cuma nangkep <td>, header pakai <th>), tapi eksplisit lebih aman.
  const tbodyM = tableHtml.match(/<tbody[\s>][\s\S]*?<\/tbody>/i);
  const scanHtml = tbodyM ? tbodyM[0] : tableHtml;

  const models = [];
  const trRe = /<tr[\s>][\s\S]*?<\/tr>/gi;
  let trM;
  while ((trM = trRe.exec(scanHtml)) !== null) {
    const trHtml = trM[0];

    // Indeks kolom TIDAK di-hardcode — datang dari parseTableHeaderMap().
    const tdRe = /<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let tdM;
    while ((tdM = tdRe.exec(trHtml)) !== null) cells.push(tdM[1]);
    if (cells.length === 0) continue; // header row atau row kosong

    const nameCell = cells[col.name];
    if (nameCell === undefined) continue; // baris ga punya kolom nama — skip, bukan crash

    // decodeEntities (shared w/ freellm.mjs) instead of an inline &amp;/&lt;/&gt;
    // subset — that subset used to mangle names carrying &#39; or &nbsp;.
    const modelName = decodeEntities(nameCell.replace(/<[^>]+>/g, "")).trim();
    if (!modelName) continue;
    if (NOTE_PATTERN.test(modelName)) continue; // skip disclaimer rows
    if (GENERIC_MODELS_PATTERN.test(modelName) && !/[\d\-\/]/.test(modelName)) continue;

    // Kolom limits opsional: kalau headernya emang ga ada, rateLimit tetap null.
    let rateLimit = null;
    if (col.limits !== null && cells[col.limits] !== undefined) {
      // Replace <br> / <br /> with ", " and strip remaining tags
      const limitsRaw = cells[col.limits]
        .replace(/<br\s*\/?>/gi, ", ")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      rateLimit = cleanStr(limitsRaw);
    }

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
//
// Format B has no header row / column concept at all — it's located by a
// literal `**Limits[...]**:` text marker and markdown bullet syntax
// (`- `/`* `), not by position. So it doesn't share Format A's "column
// reordered but count unchanged" failure mode; nothing to header-map here.

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

  // Dedup by model id within a provider — defensive parity with freellm.mjs.
  // A duplicated <tr>/bullet row must not inflate modelCount, which feeds the
  // rolling sanity baseline (see docs/log.md INCIDENT 2026-07-17).
  {
    const seenIds = new Set();
    models = models.filter((m) => {
      if (seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return true;
    });
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

// ─── Self-test ────────────────────────────────────────────────────────────────
//
// Run dengan: node scripts/adapters/cheahjs.mjs --selftest
// Pure-function tests, TANPA network call (fetchReadme ga dipanggil) — cek
// parsing logic doang. Exit 1 kalau ada yang gagal. Fokus utama: pastiin
// Format A header-mapping BENERAN mencegah kelas bug INCIDENT 2026-07-25
// (kolom ketuker tapi parse tetap "sukses").

if (process.argv.includes("--selftest")) {
  import("node:assert").then(async ({ default: assert }) => {
    let passed = 0;
    let failed = 0;

    function test(description, fn) {
      try {
        fn();
        console.log(`  PASS  ${description}`);
        passed++;
      } catch (err) {
        console.error(`  FAIL  ${description}`);
        console.error(`        ${err.message}`);
        failed++;
      }
    }

    console.log("cheahjs.mjs self-test");
    console.log("─".repeat(60));

    // ════════════════════════════════════════════════════════════════
    // A. FORMAT A — HTML table, header-name mapping
    // ════════════════════════════════════════════════════════════════
    console.log("\n[A] Format A — HTML table (header-name mapping)");

    const normalTable = `<table><thead><tr><th>Model Name</th><th>Model Limits</th></tr></thead><tbody>
<tr><td>Gemini 3.5 Flash</td><td>250,000 tokens/minute<br>20 requests/day</td></tr>
<tr><td>Gemma 3 27B Instruct</td><td>15,000 tokens/minute<br>14,400 requests/day</td></tr>
</tbody></table>`;

    test("A1: normal header order maps name/limits correctly", () => {
      const models = parseHtmlTable(normalTable);
      assert.strictEqual(models.length, 2);
      assert.strictEqual(models[0].name, "Gemini 3.5 Flash");
      assert.ok(models[0].rateLimit.includes("250,000 tokens/minute"));
      assert.strictEqual(models[1].name, "Gemma 3 27B Instruct");
      assert.strictEqual(models[0].context, null); // anti-halusinasi: never invented
      assert.strictEqual(models[0].maxOutput, null);
    });

    const reorderedTable = `<table><thead><tr><th>Model Limits</th><th>Model Name</th></tr></thead><tbody>
<tr><td>250,000 tokens/minute<br>20 requests/day</td><td>Gemini 3.5 Flash</td></tr>
</tbody></table>`;

    test("A2: REORDERED columns still map correctly by header name (regression test for the swap-column bug class)", () => {
      const models = parseHtmlTable(reorderedTable);
      assert.strictEqual(models.length, 1);
      assert.strictEqual(
        models[0].name,
        "Gemini 3.5 Flash",
        "name must come from the 'Model Name' column regardless of position",
      );
      assert.ok(
        models[0].rateLimit.includes("250,000 tokens/minute"),
        "rateLimit must come from the 'Model Limits' column regardless of position",
      );
    });

    const missingNameHeaderTable = `<table><thead><tr><th>Score</th><th>Model Limits</th></tr></thead><tbody>
<tr><td>81</td><td>250,000 tokens/minute</td></tr>
</tbody></table>`;

    test("A3: missing model-name header THROWS (never silently misassigns a column)", () => {
      assert.throws(
        () => parseHtmlTable(missingNameHeaderTable),
        /kolom nama model ga ada/,
        "expected throw naming the headers actually seen",
      );
    });

    const noTheadTable = `<table><tbody>
<tr><td>Gemini 3.5 Flash</td><td>250,000 tokens/minute</td></tr>
</tbody></table>`;

    test("A4: missing <thead> entirely THROWS (structural change, not a guessable fallback)", () => {
      assert.throws(() => parseHtmlTable(noTheadTable), /<thead> ga ketemu/);
    });

    const noLimitsColTable = `<table><thead><tr><th>Model Name</th></tr></thead><tbody>
<tr><td>Solo Model</td></tr>
</tbody></table>`;

    test("A5: table with no limits column at all -> rateLimit null (absent upstream, never backfilled)", () => {
      const models = parseHtmlTable(noLimitsColTable);
      assert.strictEqual(models.length, 1);
      assert.strictEqual(models[0].name, "Solo Model");
      assert.strictEqual(models[0].rateLimit, null);
    });

    test("A6: header aliases resolve case/spacing variants (\"context window\"-style renames)", () => {
      const aliasTable = `<table><thead><tr><th>MODEL</th><th>Rate Limit</th></tr></thead><tbody>
<tr><td>Foo Bar</td><td>10 req/min</td></tr>
</tbody></table>`;
      const models = parseHtmlTable(aliasTable);
      assert.strictEqual(models.length, 1);
      assert.strictEqual(models[0].name, "Foo Bar");
      assert.strictEqual(models[0].rateLimit, "10 req/min");
    });

    // ════════════════════════════════════════════════════════════════
    // B. FORMAT B — **Limits:** block + bullet list (label-keyed, not positional)
    // ════════════════════════════════════════════════════════════════
    console.log("\n[B] Format B — Limits block + bullets");

    test("B1: parseLimitsBlock extracts plain limits text, <br> -> \", \"", () => {
      const r = parseLimitsBlock("20 requests/minute<br>50 requests/day");
      assert.strictEqual(r, "20 requests/minute, 50 requests/day");
    });

    test("B2: parseLimitsBlock strips markdown link wrapper", () => {
      const r = parseLimitsBlock(
        "[20 requests/minute<br>50 requests/day](https://example.com/limits)",
      );
      assert.strictEqual(r, "20 requests/minute, 50 requests/day");
    });

    test("B3: parseBulletModels extracts model names + shared rate limit", () => {
      const block = "- Model One\n- Model Two\n* Model Three\n";
      const models = parseBulletModels(block, "20 req/min");
      assert.strictEqual(models.length, 3);
      assert.deepStrictEqual(
        models.map((m) => m.name),
        ["Model One", "Model Two", "Model Three"],
      );
      assert.ok(models.every((m) => m.rateLimit === "20 req/min"));
    });

    test("B4: parseBulletModels skips generic section-descriptor bullets", () => {
      const block = "- Open and Proprietary Mistral models\n- mistral-7b-instruct\n";
      const models = parseBulletModels(block, null);
      assert.strictEqual(models.length, 1);
      assert.strictEqual(models[0].name, "mistral-7b-instruct");
    });

    // ════════════════════════════════════════════════════════════════
    // C. parseProviderBlock end-to-end (format dispatch, no network)
    // ════════════════════════════════════════════════════════════════
    console.log("\n[C] parseProviderBlock end-to-end");

    test("C1: parseProviderBlock picks Format A when a <table> is present", () => {
      const p = parseProviderBlock("[Groq](https://console.groq.com)", "\n" + normalTable + "\n");
      assert.strictEqual(p.name, "Groq");
      assert.strictEqual(p.models.length, 2);
    });

    test("C2: parseProviderBlock picks Format B when no <table> is present", () => {
      const body =
        "\n**Limits:** 20 requests/minute<br>50 requests/day\n\n- Model A\n- Model B\n";
      const p = parseProviderBlock("[OpenRouter](https://openrouter.ai)", body);
      assert.strictEqual(p.name, "OpenRouter");
      assert.strictEqual(p.models.length, 2);
      assert.ok(p.models[0].rateLimit.includes("20 requests/minute"));
    });

    test("C3: parseProviderBlock with a Format A table missing the model-name header propagates the throw (source gets skipped upstream in sync.mjs, not silently wrong)", () => {
      assert.throws(() => parseProviderBlock("[Bad](https://example.com)", "\n" + missingNameHeaderTable + "\n"));
    });

    // ─── Summary ────────────────────────────────────────────────────
    console.log("\n" + "─".repeat(60));
    console.log(`${passed} passed, ${failed} failed`);

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log("All tests passed.");
    }
  });
}
