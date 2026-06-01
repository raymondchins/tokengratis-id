"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { filterProviders, emptyFilter, type FilterState } from "@/lib/data";
import type { Modality, Provider } from "@/lib/types";
import FilterBar from "@/components/directory/FilterBar";
import {
  CategoryTag,
  ModalityTags,
  MODALITY_ORDER,
} from "@/components/directory/Badges";
import Spark from "@/components/Spark";

const GRID =
  "grid min-w-[940px] grid-cols-[minmax(190px,1.9fr)_minmax(150px,1.2fr)_minmax(84px,0.6fr)_minmax(220px,1.9fr)_auto] items-center gap-4 px-5";

function ProviderRow({ p }: { p: Provider }) {
  return (
    <div className={`${GRID} border-t border-ink-line py-4 transition-colors hover:bg-ink/40`}>
      {/* Provider */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-line bg-ink text-base">
          <span aria-hidden>{p.flag}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-fog">{p.name}</span>
            <CategoryTag category={p.category} />
          </div>
          <p className="mt-0.5 text-[11px] text-mute">{p.modelCount} model</p>
        </div>
      </div>

      {/* Kemampuan */}
      <div>
        <ModalityTags modalities={p.modalities} />
      </div>

      {/* Context maks */}
      <div className="text-sm font-semibold">
        {p.maxContext ? (
          <span className="text-grass">{p.maxContext}</span>
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

      {/* Aksi */}
      <div className="flex justify-end">
        <Link
          href={`/provider/${p.slug}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-ember px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ember-soft"
        >
          <Spark className="h-3.5 w-3.5" />
          Lihat
        </Link>
      </div>
    </div>
  );
}

export default function DirectoryClient({ providers }: { providers: Provider[] }) {
  const [filter, setFilter] = useState<FilterState>(emptyFilter());
  const results = filterProviders(providers, filter);

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

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink-soft">
        <div className="overflow-x-auto">
          <div className={`${GRID} py-3 text-[11px] font-semibold uppercase tracking-wider text-mute`}>
            <span>Provider</span>
            <span>Kemampuan</span>
            <span>Context maks</span>
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

      {/* Count */}
      <p className="text-sm text-mute">
        Menampilkan <span className="font-semibold text-fog">{results.length}</span>{" "}
        dari <span className="font-semibold text-fog">{providers.length}</span> provider
      </p>
    </div>
  );
}
