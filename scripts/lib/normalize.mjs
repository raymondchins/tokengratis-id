// Shared normalisasi buat semua source adapter + merge stage.
// Anti-halusinasi: helper di sini CUMA membersihkan / men-derive dari data yang
// EKSPLISIT ada di sumber. Ga ada yang nebak nilai baru.
//
// KONTRAK ADAPTER: tiap adapter (scripts/adapters/*.mjs) export `async function
// fetchProviders(): Promise<ProviderPartial[]>` yang return array provider dengan
// shape di bawah. Slug WAJIB lewat canonicalSlug() biar dedup nyambung antar sumber.
//
//   ProviderPartial = {
//     slug,            // string — WAJIB canonicalSlug(name)
//     name,            // string
//     category,        // "provider_api" | "inference_provider" | null
//     country,         // ISO-2 | null
//     flag,            // emoji | null
//     url,             // string | null  (halaman API key / provider)
//     baseUrl,         // string | null
//     description,     // string ("" kalau ga ada)
//     models,          // Model[]  ({ id, name, context, maxOutput, modality, rateLimit })
//     sourceUpdatedAt, // ISO | null
//     source,          // SourceRef { name, url, syncedAt }  — sumber ini
//   }
//
// Field turunan (domain, logo, modalities, modelCount, maxContext, freeLimit)
// DIHITUNG di merge stage — adapter ga perlu isi. Tapi kalau adapter punya
// description bagus, dia boleh ikut nentuin freeLimit lewat merge (otomatis).

// ─── Konstanta sumber (dipakai adapter + merge untuk prioritas) ────────────────

export const SOURCES = {
  mnfst: {
    name: "mnfst/awesome-free-llm-apis",
    url: "https://github.com/mnfst/awesome-free-llm-apis",
  },
  freellm: {
    name: "freellm.net",
    url: "https://freellm.net",
  },
  cheahjs: {
    name: "cheahjs/free-llm-api-resources",
    url: "https://github.com/cheahjs/free-llm-api-resources",
  },
};

/** Urutan prioritas merge (index kecil = menang saat gap-fill scalar field). */
export const SOURCE_PRIORITY = [
  SOURCES.mnfst.name,
  SOURCES.freellm.name,
  SOURCES.cheahjs.name,
];

// ─── String / URL hygiene ──────────────────────────────────────────────────────

/** Buang nilai sentinel ("—"/"-"/"N/A"/kosong) → null (anti-halusinasi: ga simpen placeholder). */
const SENTINELS = new Set([
  "—", // em dash —
  "–", // en dash –
  "-",
  "n/a",
  "N/A",
  "N/a",
  "none",
  "None",
  "null",
  "undefined",
]);
export function cleanStr(v) {
  if (!v) return null;
  const t = String(v).trim();
  return t && !SENTINELS.has(t) ? t : null;
}

/** Allowlist scheme: cuma http(s). Blok javascript:/data: dll dari sumber. */
export function safeUrl(u) {
  if (!u) return null;
  try {
    return /^https?:$/.test(new URL(u).protocol) ? u : null;
  } catch {
    return null;
  }
}

/** Slugify dasar: lowercase → strip () → non-alnum jadi "-" → trim. */
export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Canonical slug + alias map (dedup antar sumber) ──────────────────────────
// Sumber beda nyebut provider yang sama dengan nama beda
// ("Google AI Studio" vs "Gemini API"). Map ini nyatuin ke SATU slug canonical.
// Slug canonical = yang dipakai mnfst (sumber prioritas #1) + POPULARITY di lib/data.ts.
// Tambah entri seiring nemu overlap baru.

const ALIAS = {
  // Google Gemini
  "google-ai-studio": "google-gemini",
  "google-ai-studio-gemini-api": "google-gemini",
  "google-ai": "google-gemini",
  "google-gemini-api": "google-gemini",
  gemini: "google-gemini",
  "gemini-api": "google-gemini",
  // Groq
  "groq-cloud": "groq",
  groqcloud: "groq",
  "groq-api": "groq",
  // Cloudflare Workers AI
  cloudflare: "cloudflare-workers-ai",
  "cloudflare-ai": "cloudflare-workers-ai",
  "cloudflare-workers": "cloudflare-workers-ai",
  "workers-ai": "cloudflare-workers-ai",
  // Mistral
  mistral: "mistral-ai",
  mistralai: "mistral-ai",
  "mistral-api": "mistral-ai",
  // OpenRouter
  "open-router": "openrouter",
  "openrouter-ai": "openrouter",
  // GitHub Models
  github: "github-models",
  "github-marketplace-models": "github-models",
  "github-marketplace": "github-models",
  // NVIDIA NIM
  nvidia: "nvidia-nim",
  "nvidia-nim-api": "nvidia-nim",
  "nvidia-api-catalog": "nvidia-nim",
  // Hugging Face
  huggingface: "hugging-face",
  hf: "hugging-face",
  "hugging-face-inference": "hugging-face",
  "huggingface-inference": "hugging-face",
  "huggingface-inference-providers": "hugging-face",
  "hugging-face-inference-providers": "hugging-face",
  // xAI
  "x-ai": "xai",
  grok: "xai",
  "grok-xai": "xai",
  // Zhipu / GLM
  zhipu: "z-ai-zhipu-ai",
  zhipuai: "z-ai-zhipu-ai",
  "zhipu-ai": "z-ai-zhipu-ai",
  glm: "z-ai-zhipu-ai",
  "z-ai": "z-ai-zhipu-ai",
  // Alibaba / Qwen / DashScope
  alibaba: "alibaba-cloud-model-studio",
  "alibaba-cloud": "alibaba-cloud-model-studio",
  qwen: "alibaba-cloud-model-studio",
  dashscope: "alibaba-cloud-model-studio",
  "model-studio": "alibaba-cloud-model-studio",
  // OVHcloud
  ovh: "ovhcloud-ai-endpoints",
  ovhcloud: "ovhcloud-ai-endpoints",
  "ovh-cloud": "ovhcloud-ai-endpoints",
  "ovhcloud-ai": "ovhcloud-ai-endpoints",
  // SambaNova
  "samba-nova": "sambanova",
  "sambanova-cloud": "sambanova",
  // Cerebras
  "cerebras-cloud": "cerebras",
  "cerebras-inference": "cerebras",
  // AI21
  ai21: "ai21-labs",
  ai21labs: "ai21-labs",
  // DeepSeek
  "deepseek-api": "deepseek",
  // SiliconFlow
  siliconflow: "siliconflow",
  "silicon-flow": "siliconflow",
  // Nebius
  "nebius-ai-studio": "nebius",
  "nebius-ai": "nebius",
};

/** Slug canonical: slugify lalu resolve alias. Inilah dedup-key provider. */
export function canonicalSlug(name) {
  const s = slugify(name);
  return ALIAS[s] || s;
}

// ─── Model key (dedup model antar sumber dalam 1 provider) ─────────────────────
// Nama model beda antar sumber: "Llama 3.3 70B" vs "llama-3.3-70b-versatile" vs
// "Meta: Llama 3.3 70B (free)". Normalisasi agresif biar yang sama ketemu.
// Imperfect by design — kalau ga match, model dianggap beda (ditambah, bukan ilang).

// CUMA pure-vendor (kata yg ga pernah jadi nama-family model). Sengaja TANPA
// mistral/qwen/deepseek/minimax/zhipu — itu juga head nama model ("Mistral Small",
// "DeepSeek R1"), strip-nya malah bikin gagal-match lintas sumber.
const VENDOR_WORD =
  /^(openai|google|meta|mistralai|nvidia|anthropic|microsoft|cohere|moonshotai|moonshot|alibaba|poolside|inclusionai|nousresearch|nous)[\s:]+/i;

export function modelKey(nameOrId) {
  let s = String(nameOrId || "").toLowerCase().trim();
  // id path-style: "@cf/meta/llama-x" / "moonshotai/kimi:free" → segmen terakhir
  if (s.includes("/")) s = s.split("/").pop();
  // penanda free: "(free)", ":free", " free"
  s = s.replace(/\(free\)|:free\b|\bfree\b/g, " ");
  // prefix vendor bentuk colon: "Meta: ", "Google: "
  s = s.replace(/^[a-z0-9.\s]+:\s*/i, "");
  // prefix vendor bentuk kata: "OpenAI ", "Meta ", "Qwen "
  s = s.replace(VENDOR_WORD, "");
  // suffix varian umum
  s = s.replace(/[-_\s]?(instruct|versatile|instant|chat|preview|latest|turbo)\b/g, "");
  // sisanya: alnum doang
  return s.replace(/[^a-z0-9]+/g, "").trim();
}

// ─── Facet modality ────────────────────────────────────────────────────────────

export const MODALITY_ORDER = [
  "text",
  "vision",
  "image",
  "audio",
  "video",
  "code",
  "embeddings",
  "reranking",
];

/** Derive facet modality dari string mentah sumber (mis. "Text + Vision"). */
export function facetsOf(modality) {
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
  // ANTI-HALUSINASI: kalau sumber ga nyebut modality apa-apa (string kosong),
  // JANGAN nebak "text". Biarin kosong — facet absent != facet "text".
  return [...f];
}

/** Union facet dari kumpulan model, urut sesuai MODALITY_ORDER. */
export function modalitiesOf(models) {
  return MODALITY_ORDER.filter((facet) =>
    models.some((m) => facetsOf(m.modality).includes(facet)),
  );
}

// ─── Context numeric ─────────────────────────────────────────────────────────

/** "256K"/"1M"/"2B" -> angka, buat nyari context maks. (mirror lib/ctxnum.ts) */
export function ctxNum(c) {
  if (!c) return 0;
  const m = String(c).match(/([\d.]+)\s*([KkMmBb]?)/);
  if (!m) return 0;
  let n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u === "k") n *= 1e3;
  if (u === "m") n *= 1e6;
  if (u === "b") n *= 1e9;
  return n;
}

/** Context window terbesar (string) di antara model-nya. null kalau kosong. */
export function maxContextOf(models) {
  let best = null;
  for (const m of models) {
    if (ctxNum(m.context) > ctxNum(best)) best = m.context;
  }
  return best || null;
}

/**
 * Model yang SECARA SEMANTIK ga punya context-window token (embeddings,
 * reranking, transkripsi audio). Sumber sekunder (freellm) sering ngisi angka
 * generik (mis. "131K") buat baris ini, padahal sumber otoritatif (mnfst)
 * nandain "—" (N/A). ANTI-HALUSINASI: context/maxOutput buat model begini
 * dipaksa null — mending kosong daripada nampilin angka yang ga berlaku.
 */
export function noTokenContext(modality, id = "", name = "") {
  const s = `${modality} ${id} ${name}`.toLowerCase();
  if (/embed|rerank/.test(s)) return true;
  if (/whisper|transcrib|speech.?to.?text|\bstt\b/.test(s)) return true;
  if (/audio\s*(?:→|->|to)\s*text/.test(s)) return true;
  return false;
}

// ─── Domain (buat logo favicon) ────────────────────────────────────────────────

/** Ambil registrable domain dari URL (buat fetch logo provider). */
export function domainOf(...urls) {
  for (const u of urls) {
    if (!u) continue;
    try {
      const host = new URL(u).hostname.replace(/^www\./, "");
      const parts = host.split(".");
      if (parts.length <= 2) return host;
      const tld2 = parts.slice(-2).join(".");
      if (/^(co|com|net|org|gov|ac|edu|or|my|sch|go)\.\w{2,3}$/.test(tld2)) {
        return parts.slice(-3).join(".");
      }
      return parts.slice(-2).join(".");
    } catch {
      /* skip */
    }
  }
  return null;
}

// ─── Free limit (derive dari description) ──────────────────────────────────────

/**
 * Derive "free limit" ringkas dari description sumber.
 * Anti-halusinasi: cuma narik angka/frasa yang EKSPLISIT ada di teks. Kalau ga
 * ada sinyal apa-apa → null (jangan maksa "Free" kalau description kosong).
 */
export function freeLimitOf(desc) {
  const d = desc || "";
  if (!d.trim()) return null;
  const period = (s) =>
    /\/\s*day|per\s+day|daily/i.test(s)
      ? "/hari"
      : /\/\s*month|per\s+month|monthly/i.test(s)
        ? "/bln"
        : "";
  let m;
  if ((m = d.match(/\$[\d,]+(?:\.\d+)?/))) return `${m[0]} kredit`;
  if ((m = d.match(/([~]?[\d.,]+\s*[KMB])\b[^.]*?tokens?(\s*\/\s*\w+)?/i))) {
    const amt = m[1].replace(/\s+/g, "");
    return `${amt} token${period(m[0])}`;
  }
  if ((m = d.match(/([\d.,]+\s*[KMB])\b[^.]*?credits?/i))) {
    return `${m[1].replace(/\s+/g, "")} kredit${period(m[0])}`;
  }
  if ((m = d.match(/([\d,]+)\s*(?:API\s+)?calls?/i))) {
    return `${m[1]} calls${period(d)}`;
  }
  if ((m = d.match(/([\d,]+)\s*Neurons?/i))) return `${m[1]} Neurons/hari`;
  if ((m = d.match(/([\d,]+)\s*req(?:uests?)?\s*\/?\s*day/i)))
    return `${m[1]} req/hari`;
  if ((m = d.match(/([\d,]+)\s*RPM(?:\s*(?:per IP|\/IP))?/i)))
    return `${m[1]} RPM/IP`;
  if ((m = d.match(/([~]?\d+\+?)\s*(?:permanently\s+)?free models?/i)))
    return `${m[1]} model free`;
  if (/permanent/i.test(d)) return "Free (permanen)";
  if (/no (registration|signup|sign-up)/i.test(d)) return "Free, no signup";
  return null;
}
