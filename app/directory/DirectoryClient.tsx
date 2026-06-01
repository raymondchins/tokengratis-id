"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  filterProviders,
  emptyFilter,
  sortProviders,
  SORT_LABELS,
  type FilterState,
  type SortKey,
} from "@/lib/data";
import type { Modality, Provider } from "@/lib/types";
import FilterBar from "@/components/directory/FilterBar";
import {
  CategoryTag,
  ModalityTags,
  MODALITY_ORDER,
} from "@/components/directory/Badges";
import ProviderLogo from "@/components/ProviderLogo";
import Spark from "@/components/Spark";

const GRID =
  "grid min-w-[960px] grid-cols-[minmax(190px,1.8fr)_minmax(130px,1fr)_minmax(120px,0.9fr)_minmax(200px,1.7fr)_108px] items-start gap-4 px-5 text-left";

function ProviderRow({ p }: { p: Provider }) {
  return (
    <Link
      href={`/provider/${p.slug}`}
      className={`group ${GRID} border-t border-ink-line py-4 transition-colors hover:bg-ink/40`}
    >
      {/* Provider */}
      <div className="flex items-center gap-3 min-w-0">
        <ProviderLogo logo={p.logo} flag={p.flag} name={p.name} className="h-9 w-9" />
        <div className="min-w-0">
          <span className="block truncate font-semibold text-fog">{p.name}</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[11px] text-mute">{p.modelCount} model</span>
            <CategoryTag category={p.category} />
          </div>
        </div>
      </div>

      {/* Kemampuan */}
      <div>
        <ModalityTags modalities={p.modalities} />
      </div>

      {/* Free limit */}
      <div className="text-sm font-semibold">
        {p.freeLimit ? (
          <span className="text-grass">{p.freeLimit}</span>
        ) : (
          <span className="text-mute">—</span>
        )}
      </div>

      {/* Catatan (teks apa adanya dari sumber) */}
      <div>
        <p className="line-clamp-2 text-[13px] leading-snug text-mute">
          {p.description || "—"}
        </p>
      </div>

      {/* Aksi (visual — seluruh row yang jadi link) */}
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-ember px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-ember-soft">
          <Spark className="h-3.5 w-3.5" />
          Lihat
        </span>
      </div>
    </Link>
  );
}

export default function DirectoryClient({ providers }: { providers: Provider[] }) {
  const [filter, setFilter] = useState<FilterState>(emptyFilter());
  const [sort, setSort] = useState<SortKey>("popular");
  const results = sortProviders(filterProviders(providers, filter), sort);

  const availableModalities = useMemo<Modality[]>(() => {
    const present = new Set(providers.flatMap((p) => p.modalities));
    return MODALITY_ORDER.filter((m) => present.has(m));
  }, [providers]);

  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-ink-line bg-ink-soft px-8 py-20 text-center">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-grass-solid" />
        <p className="mt-4 text-base font-medium text-fog">Direktori lagi dibangun</p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-mute">
          Pipeline sync nyusul — data dari sumber komunitas lagi diproses.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        state={filter}
        onChange={setFilter}
        availableModalities={availableModalities}
      />

      {/* Count + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mute">
          Menampilkan{" "}
          <span className="font-semibold text-fog">{results.length}</span> dari{" "}
          <span className="font-semibold text-fog">{providers.length}</span> provider
        </p>
        <label className="flex items-center gap-2 text-sm text-mute">
          Urutkan
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 text-sm font-medium text-fog transition-colors hover:border-mute focus:border-fog/40 focus:outline-none"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink-soft">
        <div className="overflow-x-auto">
          <div className={`${GRID} py-3 text-[11px] font-semibold uppercase tracking-wider text-mute`}>
            <span>Provider</span>
            <span>Kemampuan</span>
            <span>Free limit</span>
            <span>Catatan</span>
            <span className="text-right">Aksi</span>
          </div>

          {results.length === 0 ? (
            <div className="border-t border-ink-line px-5 py-16 text-center">
              <p className="text-base font-medium text-fog">
                Ga ada yang cocok sama filter ini.
              </p>
              <p className="mt-2 text-sm text-mute">
                Coba hapus beberapa filter atau ganti kata kunci.
              </p>
              <button
                type="button"
                onClick={() => setFilter(emptyFilter())}
                className="mt-6 rounded-full border border-ink-line bg-ink px-5 py-2 text-sm font-medium text-fog transition-colors hover:border-fog"
              >
                Reset semua filter
              </button>
            </div>
          ) : (
            results.map((p) => <ProviderRow key={p.slug} p={p} />)
          )}
        </div>
      </div>
    </div>
  );
}
