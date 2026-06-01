// Filter + sort helpers — PURE & CLIENT-SAFE.
// SENGAJA dipisah dari lib/data.ts: data.ts `import providersData from
// "@/data/providers.json"` di module-top, jadi apa pun yang ke-import dari
// data.ts ikut narik ~70KB JSON ke client bundle. File ini CUMA boleh import
// types (lib/types.ts) + pure helper (lib/ctxnum.ts) — JANGAN import data.ts
// atau apa pun yang transitif narik JSON.

import type { Modality, ProviderListItem } from "./types";
import { ctxNum } from "./ctxnum";

export type FilterState = {
  search: string;
  modalities: Modality[];
};

export function emptyFilter(): FilterState {
  return { search: "", modalities: [] };
}

/**
 * Filter PURE & client-safe.
 * - search: substring pada searchText (nama provider + nama/id model).
 * - modalities kosong = no filter; else AND (provider wajib punya SEMUA yang dipilih).
 */
export function filterProviders(
  list: ProviderListItem[],
  f: FilterState,
): ProviderListItem[] {
  const q = f.search.trim().toLowerCase();
  return list.filter((p) => {
    if (q && !p.searchText.includes(q)) return false;
    if (
      f.modalities.length > 0 &&
      !f.modalities.every((m) => p.modalities.includes(m))
    ) {
      return false;
    }
    return true;
  });
}

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

export function sortProviders(
  list: ProviderListItem[],
  key: SortKey,
): ProviderListItem[] {
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
