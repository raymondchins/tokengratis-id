"use client";

import { useState } from "react";
import { filterOffers, emptyFilter, type FilterState } from "@/lib/data";
import type { Offer } from "@/lib/types";
import FilterBar from "@/components/directory/FilterBar";
import OfferCard from "@/components/directory/OfferCard";

export default function DirectoryClient({ offers }: { offers: Offer[] }) {
  const [filter, setFilter] = useState<FilterState>(emptyFilter());

  const results = filterOffers(offers, filter);

  // Edge case: no offers at all (pipeline not run yet)
  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-ink-line bg-ink-soft px-8 py-20 text-center">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-ember-soft" />
        <p className="mt-4 text-base font-medium text-fog">
          Direktori lagi dibangun
        </p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-mute">
          Pipeline sync nyusul — data dari sumber komunitas lagi diproses.
          Balik lagi bentar lagi.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <FilterBar state={filter} onChange={setFilter} />

      {/* Result count */}
      <p className="text-sm text-mute">
        <span className="font-medium text-fog">{results.length}</span> dari{" "}
        <span className="font-medium text-fog">{offers.length}</span> offer
      </p>

      {/* Empty state after filtering */}
      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-ink-line bg-ink-soft px-8 py-16 text-center">
          <p className="text-base font-medium text-fog">
            Ga ada yang cocok sama filter ini.
          </p>
          <p className="mt-2 text-sm text-mute">
            Coba hapus beberapa filter atau cari dengan kata kunci yang berbeda.
          </p>
          <button
            type="button"
            onClick={() => setFilter(emptyFilter())}
            className="mt-6 rounded-full border border-ink-line bg-ink px-5 py-2 text-sm font-medium text-fog transition-colors hover:border-ember hover:text-ember"
          >
            Reset semua filter
          </button>
        </div>
      ) : (
        /* Results grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((offer) => (
            <OfferCard key={offer.slug} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}
