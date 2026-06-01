"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  filterProviders,
  emptyFilter,
  sortProviders,
  SORT_LABELS,
  type FilterState,
  type SortKey,
} from "@/lib/data";
import type { Modality, ProviderListItem } from "@/lib/types";
import { DIRECTORY_GRID, DIRECTORY_PAGE_SIZE } from "@/lib/constants";
import FilterBar from "@/components/directory/FilterBar";
import { CategoryTag, ModalityTags, MODALITY_ORDER } from "@/components/directory/Badges";
import ProviderLogo from "@/components/ProviderLogo";

function ProviderRow({ p }: { p: ProviderListItem }) {
  return (
    <Link
      href={`/provider/${p.slug}`}
      aria-label={`${p.name} — ${p.modelCount} model${p.freeLimit ? `, gratis ${p.freeLimit}` : ""}`}
      className={`group ${DIRECTORY_GRID} border-t border-ink-line py-4 transition-colors hover:bg-ink/40 focus-visible:bg-ink/40 focus-visible:outline-none`}
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

      {/* Rate limit */}
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
        <span className="inline-flex items-center rounded-[6px] bg-ember px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-ember-soft">
          Lihat
        </span>
      </div>
    </Link>
  );
}

export default function DirectoryClient({ items }: { items: ProviderListItem[] }) {
  const [filter, setFilter] = useState<FilterState>(emptyFilter());
  const [sort, setSort] = useState<SortKey>("popular");
  const [page, setPage] = useState(1);

  const results = useMemo(
    () => sortProviders(filterProviders(items, filter), sort),
    [items, filter, sort],
  );

  // Reset ke hal 1 tiap filter/sort berubah.
  useEffect(() => setPage(1), [filter, sort]);

  const availableModalities = useMemo<Modality[]>(() => {
    const present = new Set(items.flatMap((p) => p.modalities));
    return MODALITY_ORDER.filter((m) => present.has(m));
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(results.length / DIRECTORY_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = results.slice(
    (current - 1) * DIRECTORY_PAGE_SIZE,
    current * DIRECTORY_PAGE_SIZE,
  );
  // Range provider yang beneran tampil di halaman ini (buat label "Menampilkan").
  const rangeFrom = (current - 1) * DIRECTORY_PAGE_SIZE + 1;
  const rangeTo = (current - 1) * DIRECTORY_PAGE_SIZE + pageItems.length;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[8px] border border-ink-line bg-ink-soft px-8 py-20 text-center">
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
        rightSlot={
          <label className="flex items-center gap-2 text-sm text-mute">
            Urutkan
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-[4px] border border-ink-line bg-ink-soft px-3 py-1.5 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {/* Table (list of links) */}
      <div className="overflow-hidden rounded-[8px] border border-ink-line bg-ink-soft">
        <div className="overflow-x-auto">
          {/* Header row — visual guide; aria-hidden karena tiap row adalah satu link, bukan grid cell */}
          <div
            aria-hidden="true"
            className={`${DIRECTORY_GRID} py-3 text-[11px] font-semibold uppercase tracking-wider text-mute`}
          >
            <span>Provider</span>
            <span>Kemampuan</span>
            <span>Rate limit</span>
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
                className="mt-6 rounded-full border border-ink-line bg-ink px-5 py-2 text-sm font-medium text-fog transition-colors hover:border-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40"
              >
                Reset semua filter
              </button>
            </div>
          ) : (
            pageItems.map((p) => <ProviderRow key={p.slug} p={p} />)
          )}
        </div>
      </div>

      {/* Count (kiri) + pagination (kanan) — 1 baris */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mute">
          {results.length === 0 ? (
            <>
              Menampilkan <span className="font-semibold text-fog">0</span> dari{" "}
              <span className="font-semibold text-fog">{items.length}</span> provider
            </>
          ) : totalPages === 1 ? (
            <>
              Menampilkan{" "}
              <span className="font-semibold text-fog">{results.length}</span> dari{" "}
              <span className="font-semibold text-fog">{items.length}</span> provider
            </>
          ) : (
            <>
              Menampilkan{" "}
              <span className="font-semibold text-fog">
                {rangeFrom}–{rangeTo}
              </span>{" "}
              dari <span className="font-semibold text-fog">{results.length}</span>{" "}
              provider
            </>
          )}
        </p>

        {totalPages > 1 && (
          <nav
            aria-label="Navigasi halaman direktori"
            className="flex items-center gap-1.5"
          >
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current <= 1}
            aria-label="Halaman sebelumnya"
            className="rounded-[6px] border border-ink-line bg-ink-soft px-3 py-1.5 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              aria-label={`Halaman ${n}`}
              aria-current={n === current ? "page" : undefined}
              className={`min-w-9 rounded-[6px] border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 ${
                n === current
                  ? "border-ember bg-ember text-white"
                  : "border-ink-line bg-ink-soft text-mute hover:border-mute hover:text-fog"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current >= totalPages}
            aria-label="Halaman berikutnya"
            className="rounded-[6px] border border-ink-line bg-ink-soft px-3 py-1.5 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </nav>
        )}
      </div>
    </div>
  );
}
