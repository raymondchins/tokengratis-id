import type { Provider, ProviderListItem } from "./types";
import providersData from "@/data/providers.json";

// Re-export filter/sort helpers buat SERVER callers (page.tsx dll) biar import
// path lama ga break. Client (DirectoryClient/FilterBar) WAJIB import langsung
// dari "@/lib/filter" — kalau lewat sini, ikut narik JSON di atas ke bundle.
export {
  filterProviders,
  sortProviders,
  emptyFilter,
  SORT_LABELS,
  type FilterState,
  type SortKey,
} from "./filter";

const providers = providersData as unknown as Provider[];

/** Semua provider (full) — buat halaman detail + sitemap. */
export function getAllProviders(): Provider[] {
  return providers;
}

/** Versi ramping buat tabel direktori (client). models[] dibuang, search di-precompute. */
let _listItems: ProviderListItem[] | null = null;
export function getListItems(): ProviderListItem[] {
  return (_listItems ??= providers.map((p) => ({
    slug: p.slug,
    name: p.name,
    logo: p.logo,
    flag: p.flag,
    category: p.category,
    modelCount: p.modelCount,
    modalities: p.modalities,
    maxContext: p.maxContext,
    freeLimit: p.freeLimit,
    description: p.description,
    searchText: `${p.name} ${p.models
      .map((m) => `${m.name} ${m.id}`)
      .join(" ")}`.toLowerCase(),
  })));
}

/** Cari satu provider by slug (full). undefined kalau ga ketemu. */
export function getProviderBySlug(slug: string): Provider | undefined {
  return providers.find((p) => p.slug === slug);
}

/** ISO timestamp sync paling baru di seluruh provider (buat label "Last update"). */
export function getLastUpdated(): string | null {
  let max: string | null = null;
  for (const p of providers) {
    if (p.syncedAt && (!max || p.syncedAt > max)) max = p.syncedAt;
  }
  return max;
}

/**
 * Daftar sumber unik (name+url) di seluruh provider, diurut by berapa provider
 * yang nyumbang dari sumber itu (paling banyak duluan). Buat atribusi footer —
 * otomatis ikut berapapun sumber yang ke-wire, ga usah hardcode.
 */
export function getSources(): { name: string; url: string; count: number }[] {
  const map = new Map<string, { name: string; url: string; count: number }>();
  for (const p of providers) {
    for (const s of p.sources) {
      const cur = map.get(s.name);
      if (cur) cur.count++;
      else map.set(s.name, { name: s.name, url: s.url, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
