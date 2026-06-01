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
    const models = (p.models || []).map((m) => ({
      id: m.id,
      name: m.name,
      context: m.context || null,
      maxOutput: m.maxOutput || null,
      modality: m.modality,
      rateLimit: m.rateLimit || null,
    }));

    const modalities = ORDER.filter((f) =>
      models.some((m) => facetsOf(m.modality).includes(f)),
    );

    const maxModel = models.reduce(
      (best, m) => (ctxNum(m.context) > ctxNum(best?.context) ? m : best),
      models[0],
    );

    return {
      slug: slugify(p.name),
      name: p.name,
      category: p.category,
      country: p.country,
      flag: p.flag,
      url: p.url || null,
      baseUrl: p.baseUrl || null,
      description: p.description || "",
      modalities,
      modelCount: models.length,
      maxContext: maxModel?.context || null,
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
