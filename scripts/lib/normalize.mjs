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

// ctxNum: single source of truth ada di ../../lib/ctxnum.mjs (dipakai juga
// langsung oleh Next.js app lewat lib/ctxnum.ts) — di-import lalu di-re-export
// di sini biar caller lama (scripts/lib/merge.mjs dkk) ga perlu ganti import path.
import { ctxNum } from "../../lib/ctxnum.mjs";

// ─── Konstanta sumber (dipakai adapter + merge untuk prioritas) ────────────────

export const SOURCES = {
  // Live JSON API OpenRouter. Cuma emit provider "openrouter" — authoritative
  // buat dirinya sendiri (live API = ground truth). Lihat openrouter.mjs.
  openrouter: {
    name: "openrouter.ai/api/v1/models",
    url: "https://openrouter.ai/api/v1/models",
  },
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

/**
 * Urutan prioritas merge (index kecil = menang saat gap-fill scalar field).
 *
 * openrouter di TOP priority: adapter-nya CUMA emit provider "openrouter" dan
 * data live API = ground truth buat provider itu, jadi top priority TIDAK bisa
 * ngaruh provider lain (mnfst tetap menang buat semua provider non-openrouter).
 * Buat openrouter sendiri, model :free dari live API menang gap-fill atas entri
 * komunitas yang mungkin stale.
 */
export const SOURCE_PRIORITY = [
  SOURCES.openrouter.name,
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

/**
 * Strip inline markdown links → display text only ("[Ollama API](url)" → "Ollama API").
 * description di-render sebagai prosa plain; sintaks markdown mentah dari sumber
 * (mis. mnfst data.json kadang nyimpen "[Ollama API](https://…)") ga boleh bocor
 * ke UI. Null-safe + idempotent. Cuma link inline yang dibersihin, teks lain utuh.
 */
export function stripMdLinks(s) {
  if (s == null) return s;
  return String(s)
    // markdown link/image: "[text](url)" / "![alt](url)" → text/alt (buang leading "!" biar ga ada orphan)
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1")
    // inline code: "`code`" → "code"
    .replace(/`([^`]+)`/g, "$1");
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

// ─── HTML entity decode + tag strip (shared by HTML/markdown adapters) ────────
// Dipindah dari freellm.mjs (dulu duplikat parsial di cheahjs.mjs — cheahjs
// cuma nangkep &amp;/&lt;/&gt;, jadi &#39;/&nbsp; di nama model kebawa mentah).

/** Basic HTML entity decoder — covers &amp;/&lt;/&gt;/&quot;/&#39;/&nbsp;/numeric entities. */
export function decodeEntities(s) {
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

/** Strip all HTML tags and decode entities, returning trimmed plain text. */
export function textOf(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
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
  "mistral-codestral": "mistral-ai",
  codestral: "mistral-ai",
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
  // suffix kosmetik (NON-varian): cuma kata yang ga pernah mbedain model.
  // SENGAJA TANPA turbo/instant/versatile + date/version stamp (mis. -08-2024,
  // 0905) — itu nandain MODEL BERBEDA. Strip-nya bikin over-merge → model real
  // ke-drop (whisper-large-v3-turbo, command-r-08-2024, Kimi K2 0905). Lebih
  // baik under-merge (2 baris near-dup) daripada over-merge (ilang 1 model real).
  s = s.replace(/[-_\s]?(instruct|chat|preview|latest)\b/g, "");
  // sisanya: alnum doang
  return s.replace(/[^a-z0-9]+/g, "").trim();
}

// ─── Section-descriptor guard (shared: cheahjs adapter + sync.mjs smoke test) ──
/**
 * Guard: matches bullets/model rows that are generic section descriptors, not
 * callable model ids — e.g. "Open and Proprietary Mistral models". Real model
 * names always contain a version token (number, dash-id, or slash) such as
 * "mistral-7b", "llama-3.1", "gpt-4o", "meta/llama-3", so they will NOT match
 * this pattern on their own — callers pair it with a `!/[\d\-\/]/.test(...)`
 * check to confirm the string carries no such token before rejecting it.
 *
 * Rule: the string ends with the word "models" (plural).
 *
 * Examples that WILL match (rejected — descriptors, when paired with the
 * no-digit/dash/slash check above):
 *   "Open and Proprietary Mistral models"
 *   "Various open models"
 *
 * Examples that will NOT match (kept — real model names):
 *   "mistral-7b-instruct"     ← has dash
 *   "meta/llama-3.1-8b"      ← has slash + digit
 *   "Mistral Large"           ← no "models" suffix
 */
export const GENERIC_MODELS_PATTERN = /\bmodels\s*$/i;

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

/**
 * Normalisasi nilai modality buat field model: string trimmed, atau `null`
 * kalau kosong / whitespace-only. Schema = `modality: string | null` — JANGAN
 * simpen "" (string kosong). Idempotent: cleanModality(null) === null.
 */
export function cleanModality(modality) {
  if (modality == null) return null;
  const t = String(modality).trim();
  return t ? t : null;
}

/**
 * Derive facet modality dari string mentah sumber (mis. "Text + Vision").
 * Null-safe: `null`/`undefined`/""/whitespace → [] (ga nebak "text").
 */
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

// ctxNum itself is imported from ../../lib/ctxnum.mjs (see top of file) and
// re-exported here so existing callers (scripts/lib/merge.mjs) keep working.
export { ctxNum };

/**
 * Bersihin FORMAT display string context — TANPA ngubah magnitude.
 * - buang qualifier depan "Up to "/"up to " (mis. cloudflare "Up to 10M" → "10M")
 * - drop trailing ".0" sebelum unit K/M/B (mis. nvidia "1.0M" → "1M", "2.0M" → "2M")
 * Cuma kosmetik: angka + unit tetep sama persis.
 */
export function cleanCtxStr(c) {
  if (c == null) return c;
  let s = String(c).trim().replace(/^up\s+to\s+/i, "");
  s = s.replace(/(\d+)\.0+\s*([KkMmBb])\b/g, "$1$2");
  return s;
}

/** Context window terbesar (string) di antara model-nya. null kalau kosong. */
export function maxContextOf(models) {
  let best = null;
  for (const m of models) {
    if (ctxNum(m.context) > ctxNum(best)) best = m.context;
  }
  return best ? cleanCtxStr(best) : null;
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
  if ((m = d.match(/\$[\d,]+(?:\.\d+)?/))) {
    // ANTI-HALUSINASI: kredit trial sekali-pakai / kadaluarsa BUKAN free allowance
    // standing. Biarin `description` verbatim yang bawa term aslinya.
    if (/one[- ]?time|expir|trial|sign[- ]?up\s+credit/i.test(d)) return null;
    return `${m[0]} kredit`;
  }
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
