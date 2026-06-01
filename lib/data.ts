import type { Modality, Provider } from "./types";
import providersData from "@/data/providers.json";

const providers = providersData as Provider[];

/** Semua provider dari data/providers.json (read-only, di-generate scripts/sync.mjs). */
export function getAllProviders(): Provider[] {
  return providers;
}

/** Cari satu provider by slug. undefined kalau ga ketemu. */
export function getProviderBySlug(slug: string): Provider | undefined {
  return providers.find((p) => p.slug === slug);
}

export type FilterState = {
  search: string;
  modalities: Modality[];
};

// ─── Sort ─────────────────────────────────────────────────────────────────────
// "Popularitas" = editorial (sumber ga nyediain metric ini). Urutan kasar by
// brand-recognition di kalangan dev AI. Slug yang ga ada di list → paling bawah.

const POPULARITY: string[] = [
  "google-gemini",
  "groq",
  "openrouter",
  "deepseek",
  "mistral-ai",
  "hugging-face",
  "xai",
  "cerebras",
  "cohere",
  "cloudflare-workers-ai",
  "github-models",
  "nvidia-nim",
  "nebius",
  "ollama-cloud",
  "z-ai-zhipu-ai",
  "alibaba-cloud-model-studio",
  "siliconflow",
  "modelscope",
  "ovhcloud-ai-endpoints",
  "nscale",
  "kilo-code",
  "llm7-io",
  "aion-labs",
  "ai21-labs",
];

export type SortKey = "popular" | "context" | "models" | "name";

export const SORT_LABELS: Record<SortKey, string> = {
  popular: "Paling populer",
  context: "Context terbesar",
  models: "Model terbanyak",
  name: "Nama (A–Z)",
};

function ctxNum(c: string | null): number {
  if (!c) return 0;
  const m = String(c).match(/([\d.]+)\s*([KkMm]?)/);
  if (!m) return 0;
  let n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u === "k") n *= 1e3;
  if (u === "m") n *= 1e6;
  return n;
}

export function sortProviders(list: Provider[], key: SortKey): Provider[] {
  const arr = [...list];
  switch (key) {
    case "popular":
      return arr.sort((a, b) => {
        const ai = POPULARITY.indexOf(a.slug);
        const bi = POPULARITY.indexOf(b.slug);
        return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      });
    case "context":
      return arr.sort((a, b) => ctxNum(b.maxContext) - ctxNum(a.maxContext));
    case "models":
      return arr.sort((a, b) => b.modelCount - a.modelCount);
    case "name":
      return arr.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export function emptyFilter(): FilterState {
  return { search: "", modalities: [] };
}

/**
 * Filter PURE & client-safe.
 * - search: substring pada nama provider + nama/id model.
 * - categories kosong = no filter; else keep kalau category match.
 * - modalities kosong = no filter; else keep kalau provider punya ≥1 modality match.
 */
export function filterProviders(list: Provider[], f: FilterState): Provider[] {
  const q = f.search.trim().toLowerCase();

  return list.filter((p) => {
    if (q) {
      const hay = (
        p.name +
        " " +
        p.models.map((m) => `${m.name} ${m.id}`).join(" ")
      ).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (
      f.modalities.length > 0 &&
      !f.modalities.some((m) => p.modalities.includes(m))
    ) {
      return false;
    }
    return true;
  });
}
