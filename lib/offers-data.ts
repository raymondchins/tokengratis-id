import type { Offer, OfferListItem, OfferCategory } from "./offer-types";
import offersData from "@/data/offers.json";

const offers = offersData as unknown as Offer[];

/** Semua offer "modal gratis" (full) — buat halaman detail + sitemap. */
export function getAllOffers(): Offer[] {
  return offers;
}

/** Cari satu offer by slug (full). undefined kalau ga ketemu. */
export function getOfferBySlug(slug: string): Offer | undefined {
  return offers.find((o) => o.slug === slug);
}

/** Versi ramping buat tabel/list client (payload kecil, pola sama kayak ProviderListItem). */
let _listItems: OfferListItem[] | null = null;
export function getOfferListItems(): OfferListItem[] {
  return (_listItems ??= offers.map((o) => ({
    slug: o.slug,
    name: o.name,
    vendor: o.vendor,
    domain: o.domain,
    category: o.category,
    kind: o.kind,
    creditValue: o.creditValue,
    facets: o.facets,
    idIndie: o.idIndie,
    description: o.description,
    searchText: `${o.name} ${o.vendor} ${o.limits.join(" ")}`.toLowerCase(),
  })));
}

/** Jumlah offer per kategori — cuma kategori yang beneran punya entry. */
let _categoryCounts: Partial<Record<OfferCategory, number>> | null = null;
export function getOfferCategoryCounts(): Partial<Record<OfferCategory, number>> {
  if (_categoryCounts) return _categoryCounts;
  const counts: Partial<Record<OfferCategory, number>> = {};
  for (const o of offers) {
    counts[o.category] = (counts[o.category] ?? 0) + 1;
  }
  return (_categoryCounts = counts);
}

/**
 * Tanggal `checkedAt` paling baru di seluruh source seluruh offer — provenance
 * buat label "kurasi terakhir dicek", bukan klaim "masih akurat sekarang".
 * null kalau belum ada offer sama sekali.
 */
export function getOffersLastCheckedAt(): string | null {
  let max: string | null = null;
  for (const o of offers) {
    for (const s of o.sources) {
      if (!max || s.checkedAt > max) max = s.checkedAt;
    }
  }
  return max;
}
