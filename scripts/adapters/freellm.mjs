/**
 * Source adapter — freellm.net
 *
 * Scrapes https://freellm.net/models/ (server-rendered static HTML table).
 * No browser / JS execution needed — all data is in the raw HTML response.
 *
 * KOLOM DI-MAP BY NAMA HEADER, BUKAN BY INDEKS. Jangan pernah balik ke indeks
 * hardcoded — itu sudah pernah bikin data salah diam-diam:
 *
 *   INCIDENT 2026-07-25. freellm.net nyisipin kolom "Score" di indeks 2 dan
 *   ngebuang kolom "Max Output". Jumlah kolom tetap sama (9), jumlah baris
 *   normal, jadi sanity floor + diff guard SEMUA lolos — yang berubah cuma
 *   ARTI tiap kolom. Akibatnya `context` keisi skor (81, 40, 45…) dan
 *   `maxOutput` keisi context. 216 dari 398 model kena. Ketahuan cuma karena
 *   ada yang ngeliat "context=81" di output CLI.
 *
 *   Layout LAMA  : Provider │ Model │ Context │ Max Output │ Modality │ Rate Limit │ …
 *   Layout BARU  : Provider │ Model │ Score   │ Context    │ Modality │ Rate Limit │ …
 *
 *   Pelajaran: parse yang SUKSES tapi salah kolom itu lebih bahaya daripada
 *   parse yang gagal — guard berbasis jumlah ga akan pernah nangkep. Makanya
 *   sekarang: (a) header dibaca dan dipetakan by nama, (b) kolom "Context"
 *   hilang = throw (bukan diam-diam null), (c) ada plausibility guard yang
 *   nolak nilai context yang kelihatan kayak skor.
 *
 * Struktur HTML (verified 2026-07-25, 670 baris):
 *   <thead><tr><th>Provider</th><th>Model</th><th>Score</th><th>Context</th>
 *              <th>Modality</th><th>Rate Limit</th><th>Released</th>
 *              <th>Weekly Tokens</th><th>Status</th></tr></thead>
 *   <tbody id="modelsBody">
 *     <tr data-provider="ProviderName" data-modality="text,vision" data-free="1" ...>
 *       <td> <a>ProviderName</a> </td>
 *       <td> <a class="model-link">ModelName</a> [badges] </td>
 *       <td class="mono">81</td>                 ← Score (DIABAIKAN, bukan data kita)
 *       <td class="mono">256K</td>               ← Context
 *       <td> <span class="modality-tags">…</span> </td>
 *       <td class="mono small">30 RPM</td>       ← Rate Limit
 *       …Released / Weekly Tokens / Status / Details (diabaikan)
 *     </tr>
 *   </tbody>
 *
 * Catatan: layout sekarang TIDAK punya kolom Max Output sama sekali, jadi
 * `maxOutput` dari sumber ini selalu null. Itu benar — bukan data hilang.
 * enrich.mjs (models.dev) yang nambal maxOutput belakangan.
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

import {
  canonicalSlug,
  slugify,
  cleanStr,
  SOURCES,
  textOf,
} from "../lib/normalize.mjs";

const SOURCE_URL = "https://freellm.net/models/";

// freellm.net's own model table occasionally carries glossary/legend artifacts
// as if they were callable models (e.g. a "Abbreviation" row under SiliconFlow —
// a column-legend entry, NOT a model; it even has its own /models/.../abbreviation/
// page on their side). Anti-halusinasi: drop these exact non-model tokens.
// Conservative exact-match set so real single-word models (Codestral, Mixtral,
// Mistral, Magistral, …) are never affected.
const JUNK_MODEL_NAMES = new Set([
  "abbreviation",
  "abbreviations",
  "legend",
  "glossary",
  "notes",
  "note",
  "key",
]);

// ─── HTTP fetch with redirect-following ──────────────────────────────────────
// SENGAJA hand-rolled https.get, BUKAN built-in fetch. Pernah diganti fetch()
// (b46f7d0) → freellm.net langsung 403 dua malam dari GitHub Actions (WAF
// fingerprint request undici: accept-encoding otomatis + header set beda),
// padahal client ini terbukti berminggu-minggu dari CI yang sama. Lokal
// (IP residential) dua-duanya jalan — jadi JANGAN "modernisasi" ini lagi
// tanpa bukti hijau di CI. Lihat docs/log.md INCIDENT 2026-07-22.

function fetchHtml(url, depth = 0) {
  if (depth > 5) return Promise.reject(new Error("Too many redirects"));
  return new Promise((resolve, reject) => {
    // Dynamic import of https so the file is still pure ESM
    import("https").then(({ default: https }) => {
      const parsed = new URL(url);
      const req = https.get(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; tokengratis-sync/1.0; +https://tokengratis.id)",
            Accept: "text/html,application/xhtml+xml",
          },
          timeout: 20_000,
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
      );
      req.on("timeout", () => req.destroy(new Error(`timeout for ${url}`)));
      req.on("error", reject);
    });
  });
}

// ─── Row parser ───────────────────────────────────────────────────────────────
// decodeEntities/textOf now live in scripts/lib/normalize.mjs (shared with
// cheahjs.mjs — see that file for why).

/** Normalisasi label header jadi key: "Rate Limit" -> "ratelimit". */
function headerKey(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Baca <thead> dan petakan nama kolom -> indeks.
 *
 * Ini jantung fix INCIDENT 2026-07-25 (lihat komentar di atas file). Kalau
 * freellm geser/sisipin/buang kolom lagi, mapping ikut sendiri; kalau kolom
 * yang kita ANDALKAN hilang, kita throw — sengaja gagal berisik, karena
 * diam-diam null jauh lebih mahal daripada sync yang skip semalam.
 *
 * @returns {{context:number, maxOutput:number|null, rateLimit:number|null}}
 */
export function parseHeaderMap(html) {
  const theadM = html.match(/<thead[\s>][\s\S]*?<\/thead>/i);
  if (!theadM) {
    throw new Error("freellm.mjs: <thead> ga ketemu — struktur tabel berubah total");
  }
  const labels = (theadM[0].match(/<th(?:\s[^>]*)?>[\s\S]*?<\/th>/gi) || []).map((c) =>
    headerKey(textOf(c))
  );
  if (!labels.length) {
    throw new Error("freellm.mjs: <thead> ada tapi nol <th>");
  }

  const idx = (...aliases) => {
    for (const a of aliases) {
      const i = labels.indexOf(a);
      if (i !== -1) return i;
    }
    return null;
  };

  const context = idx("context", "contextwindow", "ctx");
  if (context === null) {
    throw new Error(
      `freellm.mjs: kolom "Context" ga ada di header [${labels.join(", ")}] — ` +
        `JANGAN tebak indeks, benerin mapping-nya dulu (lihat INCIDENT 2026-07-25)`
    );
  }

  return {
    context,
    // Layout sekarang ga punya kolom ini. null = sumber emang ga nyediain,
    // BUKAN "belum keparse". Anti-halusinasi: jangan diisi dari kolom sebelah.
    maxOutput: idx("maxoutput", "maxout", "output"),
    rateLimit: idx("ratelimit", "limits", "limit"),
  };
}

/**
 * Parse a single <tr>...</tr> string into a row object.
 * Uses data-* attributes on <tr> where available (faster + more reliable than
 * parsing inner cells for provider name and modality).
 *
 * @param {string} trHtml
 * @param {{context:number, maxOutput:number|null, rateLimit:number|null}} col
 */
function parseRow(trHtml, col) {
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

  // Indeks kolom TIDAK di-hardcode — datang dari parseHeaderMap(). Lihat
  // komentar INCIDENT 2026-07-25 di atas file sebelum mengubah ini.

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
  if (JUNK_MODEL_NAMES.has(modelName.toLowerCase())) return null; // glossary/legend artifact, not a model

  // freellm taro "0" di kolom numerik kalau nilainya unknown — itu placeholder,
  // BUKAN "max output 0". Anti-halusinasi: perlakukan "0" sebagai absent.
  const numCell = (raw) => {
    const c = cleanStr(raw);
    return c && c !== "0" ? c : null;
  };

  // ── Context ───────────────────────────────────────────────────────────────
  const contextCell = cells[col.context];
  const context = contextCell ? numCell(textOf(contextCell)) : null;

  // ── Max Output ────────────────────────────────────────────────────────────
  // col.maxOutput === null berarti tabelnya emang ga punya kolom ini (layout
  // sejak 2026-07-25). Jangan ambil dari kolom tetangga.
  const maxOutput =
    col.maxOutput !== null && cells[col.maxOutput]
      ? numCell(textOf(cells[col.maxOutput]))
      : null;

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
  const rateLimitCell = col.rateLimit !== null ? cells[col.rateLimit] : null;
  const rateLimitRaw = rateLimitCell ? textOf(rateLimitCell) : "";
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

  // Petakan kolom by nama header DULU — throw kalau "Context" ilang.
  const col = parseHeaderMap(html);

  // Isolate <tbody> to avoid false matches in <thead> or scripts
  const tbodyStart = html.indexOf("<tbody");
  const tbodyEnd = html.lastIndexOf("</tbody>");
  if (tbodyStart === -1 || tbodyEnd === -1) {
    throw new Error("freellm.mjs: could not locate <tbody> in response");
  }
  const tbody = html.slice(tbodyStart, tbodyEnd + 8);

  // Match every <tr ...>...</tr> block ([\s>] covers both <tr attr> and bare <tr>)
  const trRe = /<tr[\s>][\s\S]*?<\/tr>/g;
  const rowsByProvider = new Map(); // providerName -> { name, models[] }

  let trMatch;
  while ((trMatch = trRe.exec(tbody)) !== null) {
    const row = parseRow(trMatch[0], col);
    if (!row) continue;

    const { providerName, modelName, context, maxOutput, modality, rateLimit } =
      row;

    if (!rowsByProvider.has(providerName)) {
      rowsByProvider.set(providerName, {
        name: providerName,
        models: [],
        seenIds: new Set(),
      });
    }

    const entry = rowsByProvider.get(providerName);
    const modelId = slugify(modelName);
    // Dedup by model id within a provider. freellm.net occasionally renders
    // duplicate <tr> rows (or repeats the table), which used to double/triple
    // the parsed model count (299→618→885) and ratchet the rolling sanity
    // baseline up — then a normal-sized parse fell below the inflated floor and
    // the source got skipped nightly (see docs/log.md INCIDENT 2026-07-17).
    // First occurrence wins; identical repeats are dropped.
    if (entry.seenIds.has(modelId)) continue;
    entry.seenIds.add(modelId);

    entry.models.push({
      id: modelId,
      name: modelName,
      context,
      maxOutput,
      modality: modality || "",
      rateLimit,
    });
  }

  // ── Plausibility guard (jaring kedua untuk INCIDENT 2026-07-25) ───────────
  // Kalau mapping header entah gimana masih nunjuk kolom yang salah, nilai
  // "context" bakal kelihatan kayak skor: bilangan bulat telanjang yang kecil,
  // tanpa satuan K/M. Context asli hampir selalu ditulis "128K"/"1M"/"256K".
  // Guard berbasis JUMLAH baris ga akan pernah nangkep ini — makanya guard di
  // sini berbasis BENTUK nilai.
  const ctxVals = [...rowsByProvider.values()]
    .flatMap((p) => p.models.map((m) => m.context))
    .filter(Boolean);
  const scoreLike = ctxVals.filter((v) => /^\d{1,3}$/.test(v)).length;
  if (ctxVals.length >= 20 && scoreLike / ctxVals.length > 0.5) {
    throw new Error(
      `freellm.mjs: ${scoreLike}/${ctxVals.length} nilai context berupa angka ` +
        `telanjang <1000 — ini pola kolom ketuker (skor kebaca sebagai context). ` +
        `Cek header tabel freellm.net, lihat INCIDENT 2026-07-25.`
    );
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
