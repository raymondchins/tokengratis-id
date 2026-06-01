import type { Category, Offer, OfferType } from "./types";
import providersData from "@/data/providers.json";

const providers = providersData as Offer[];

/** Semua offer dari data/providers.json (read-only, di-generate pipeline). */
export function getAllOffers(): Offer[] {
  return providers;
}

/** Cari satu offer by slug. undefined kalau ga ketemu. */
export function getOfferBySlug(slug: string): Offer | undefined {
  return providers.find((offer) => offer.slug === slug);
}

export type FilterState = {
  search: string;
  categories: Category[];
  offerTypes: OfferType[];
  indonesiaAccessibleOnly: boolean;
  noCreditCard: boolean;
  noPhone: boolean;
  apiOnly: boolean;
};

/** State filter kosong (no filter aktif). */
export function emptyFilter(): FilterState {
  return {
    search: "",
    categories: [],
    offerTypes: [],
    indonesiaAccessibleOnly: false,
    noCreditCard: false,
    noPhone: false,
    apiOnly: false,
  };
}

/**
 * Filter PURE & client-safe (no server-only imports).
 * - search: case-insensitive substring pada nama provider.
 * - categories/offerTypes kosong = no filter; else keep kalau membership match.
 * - noCreditCard: keep requiresCreditCard === "no".
 * - noPhone: keep requiresPhoneVerification === "no".
 * - indonesiaAccessibleOnly: keep indonesiaAccess === "accessible".
 * - apiOnly: keep apiAvailable === "yes".
 */
export function filterOffers(offers: Offer[], f: FilterState): Offer[] {
  const query = f.search.trim().toLowerCase();

  return offers.filter((offer) => {
    if (query && !offer.provider.toLowerCase().includes(query)) {
      return false;
    }
    if (f.categories.length > 0 && !f.categories.includes(offer.category)) {
      return false;
    }
    if (f.offerTypes.length > 0 && !f.offerTypes.includes(offer.offerType)) {
      return false;
    }
    if (f.indonesiaAccessibleOnly && offer.indonesiaAccess !== "accessible") {
      return false;
    }
    if (f.noCreditCard && offer.requiresCreditCard !== "no") {
      return false;
    }
    if (f.noPhone && offer.requiresPhoneVerification !== "no") {
      return false;
    }
    if (f.apiOnly && offer.apiAvailable !== "yes") {
      return false;
    }
    return true;
  });
}
