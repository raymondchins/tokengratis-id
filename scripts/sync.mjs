// Pipeline sync tokengratis.id — aggregator, bukan verifier.
// Narik data dari mnfst/awesome-free-llm-apis (data.json — satu-satunya sumber
// free-LLM-API dengan JSON bersih & terstruktur), normalize ke schema kita,
// tulis ke data/providers.json. Idempotent: jalanin ulang = refresh data.
//
//   node scripts/sync.mjs
//
// Anti-halusinasi: kita CUMA mindahin field yang ada di sumber + men-derive
// facet modality / context maks dari data yang sudah eksplisit. Ga nebak.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC_URL =
  "https://raw.githubusercontent.com/mnfst/awesome-free-llm-apis/main/data.json";
const SOURCE = {
  name: "mnfst/awesome-free-llm-apis",
  url: "https://github.com/mnfst/awesome-free-llm-apis",
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "providers.json");

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Derive facet modality dari string mentah sumber (mis. "Text + Vision"). */
function facetsOf(modality) {
  const m = String(modality || "").toLowerCase();
  const f = new Set();
  if (/vision/.test(m)) f.add("vision");
  if (/image/.test(m)) f.add("image");
  if (/audio|speech/.test(m)) f.add("audio");
  if (/video/.test(m)) f.add("video");
  if (/\bcode\b/.test(m)) f.add("code");
  if (/embed/.test(m)) f.add("embeddings");
  if (/rerank/.test(m)) f.add("reranking");
  if (/text|multimodal|llm|mllm|aigc|roleplay|reasoning|safety/.test(m))
    f.add("text");
  if (f.size === 0) f.add("text");
  return [...f];
}

const ORDER = [
  "text",
  "vision",
  "image",
  "audio",
  "video",
  "code",
  "embeddings",
  "reranking",
];

/**
 * Derive "free limit" ringkas dari description sumber.
 * Anti-halusinasi: cuma narik angka/frasa yang EKSPLISIT ada di teks. Kalau ga
 * ada angka → fallback "Free" / "Free (permanen)" (yang juga eksplisit di teks).
 */
function freeLimitOf(desc) {
  const d = desc || "";
  const period = (s) =>
    /\/\s*day|per\s+day|daily/i.test(s)
      ? "/hari"
      : /\/\s*month|per\s+month|monthly/i.test(s)
        ? "/bln"
        : "";
  let m;
  // $ credits (e.g. "$10 trial credits", "$25 sign-up credit")
  if ((m = d.match(/\$[\d,]+(?:\.\d+)?/))) return `${m[0]} kredit`;
  // tokens with amount (e.g. "5M free tokens", "~1B tokens/month", "1M tokens/day")
  if ((m = d.match(/([~]?[\d.,]+\s*[KMB])\b[^.]*?tokens?(\s*\/\s*\w+)?/i))) {
    const amt = m[1].replace(/\s+/g, "");
    return `${amt} token${period(m[0])}`;
  }
  // K/M credits (e.g. "100K monthly ... credits")
  if ((m = d.match(/([\d.,]+\s*[KMB])\b[^.]*?credits?/i))) {
    return `${m[1].replace(/\s+/g, "")} kredit${period(m[0])}`;
  }
  // API calls (e.g. "1,000 API calls/month")
  if ((m = d.match(/([\d,]+)\s*(?:API\s+)?calls?/i))) {
    return `${m[1]} calls${period(d)}`;
  }
  // Neurons/day
  if ((m = d.match(/([\d,]+)\s*Neurons?/i))) return `${m[1]} Neurons/hari`;
  // req/day (e.g. "50 req/day")
  if ((m = d.match(/([\d,]+)\s*req(?:uests?)?\s*\/?\s*day/i)))
    return `${m[1]} req/hari`;
  // RPM per IP (OVHcloud)
  if ((m = d.match(/([\d,]+)\s*RPM(?:\s*(?:per IP|\/IP))?/i)))
    return `${m[1]} RPM/IP`;
  // free models count (e.g. "~28 free models", "3 permanently free models")
  if ((m = d.match(/([~]?\d+\+?)\s*(?:permanently\s+)?free models?/i)))
    return `${m[1]} model free`;
  // fallbacks (semua eksplisit di teks)
  if (/permanent/i.test(d)) return "Free (permanen)";
  if (/no (registration|signup|sign-up)/i.test(d)) return "Free, no signup";
  return "Free";
}

/** Ambil registrable domain dari URL (buat fetch logo provider). */
function domainOf(...urls) {
  for (const u of urls) {
    if (!u) continue;
    try {
      const host = new URL(u).hostname.replace(/^www\./, "");
      const parts = host.split(".");
      if (parts.length <= 2) return host;
      // handle .co.uk / .com.cn / .com.au dst
      const tld2 = parts.slice(-2).join(".");
      if (/^(co|com|net|org|gov|ac|edu)\.\w{2,3}$/.test(tld2)) {
        return parts.slice(-3).join(".");
      }
      return parts.slice(-2).join(".");
    } catch {
      /* skip */
    }
  }
  return null;
}

/** "256K" / "1M" -> angka, buat nyari context maks. */
function ctxNum(c) {
  if (!c) return 0;
  const m = String(c).match(/([\d.]+)\s*([KkMm]?)/);
  if (!m) return 0;
  let n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u === "k") n *= 1e3;
  if (u === "m") n *= 1e6;
  return n;
}

async function main() {
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`Fetch gagal: ${res.status}`);
  const data = await res.json();
  const syncedAt = new Date().toISOString();

  const providers = data.providers.map((p) => {
    const allModels = (p.models || []).map((m) => ({
      id: m.id,
      name: m.name,
      context: m.context || null,
      maxOutput: m.maxOutput || null,
      modality: m.modality,
      rateLimit: m.rateLimit || null,
    }));

    // Sumber kadang nyelipin baris "catatan" (id null), mis. "+ 42 more models".
    // Itu BUKAN model beneran → pisahin: jangan masuk tabel/hitungan, simpan
    // sebagai note "+N more".
    const models = allModels.filter((m) => m.id);
    const moreEntry = allModels.find((m) => !m.id);
    const moreModels = moreEntry
      ? moreEntry.name.replace(/^\+\s*/, "").trim()
      : null;

    const modalities = ORDER.filter((f) =>
      models.some((m) => facetsOf(m.modality).includes(f)),
    );

    const maxModel = models.reduce(
      (best, m) => (ctxNum(m.context) > ctxNum(best?.context) ? m : best),
      models[0],
    );

    const domain = domainOf(p.url, p.baseUrl);

    return {
      slug: slugify(p.name),
      name: p.name,
      category: p.category,
      country: p.country,
      flag: p.flag,
      domain,
      logo: domain
        ? `https://www.google.com/s2/favicons?sz=128&domain=${domain}`
        : null,
      url: p.url || null,
      baseUrl: p.baseUrl || null,
      description: p.description || "",
      modalities,
      modelCount: models.length,
      maxContext: maxModel?.context || null,
      moreModels,
      freeLimit: freeLimitOf(p.description),
      models,
      source: SOURCE,
      syncedAt,
      sourceUpdatedAt: data.lastUpdated || null,
    };
  });

  writeFileSync(OUT, JSON.stringify(providers, null, 2) + "\n");
  console.log(`✓ Wrote ${providers.length} providers → data/providers.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
