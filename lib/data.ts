import type { Modality, Provider, ProviderCategory } from "./types";
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
  categories: ProviderCategory[];
  modalities: Modality[];
};

export function emptyFilter(): FilterState {
  return { search: "", categories: [], modalities: [] };
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
    if (f.categories.length > 0 && !f.categories.includes(p.category)) {
      return false;
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
