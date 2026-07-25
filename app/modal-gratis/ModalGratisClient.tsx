"use client";

import { useEffect, useMemo, useState } from "react";
import type { Offer, OfferCategory, OfferFacet, OfferKind } from "@/lib/offer-types";
import {
  OFFER_CATEGORY_LABEL,
  OFFER_FACET_LABEL,
  OFFER_KIND_LABEL,
} from "@/lib/offer-types";
import Chip from "@/components/Chip";
import SearchIcon from "@/components/SearchIcon";
import Pagination from "@/components/Pagination";
import EmptyDataPanel from "@/components/EmptyDataPanel";
import NoResultsPanel from "@/components/NoResultsPanel";
import OfferCard from "@/components/offers/OfferCard";

const PAGE_SIZE = 12;

export default function ModalGratisClient({ offers }: { offers: Offer[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<OfferCategory | "">("");
  const [kind, setKind] = useState<OfferKind | "">("");
  const [facets, setFacets] = useState<OfferFacet[]>([]);
  const [page, setPage] = useState(1);

  // searchText di-precompute sekali per render list (dataset kecil, kurasi
  // manual — beda skala sama direktori LLM yang butuh payload super ramping).
  const indexed = useMemo(
    () =>
      offers.map((o) => ({
        offer: o,
        searchText: `${o.name} ${o.vendor} ${o.limits.join(" ")} ${o.description}`.toLowerCase(),
      })),
    [offers],
  );

  // Opsi filter yang beneran ada di data — urutan ikut urutan definisi label
  // map (bukan urutan kemunculan acak), cuma yang punya >=1 entry yang tampil.
  const availableCategories = useMemo(() => {
    const present = new Set(offers.map((o) => o.category));
    return (Object.keys(OFFER_CATEGORY_LABEL) as OfferCategory[]).filter((c) => present.has(c));
  }, [offers]);

  const availableKinds = useMemo(() => {
    const present = new Set(offers.map((o) => o.kind));
    return (Object.keys(OFFER_KIND_LABEL) as OfferKind[]).filter((k) => present.has(k));
  }, [offers]);

  const availableFacets = useMemo(() => {
    const present = new Set(offers.flatMap((o) => o.facets));
    return (Object.keys(OFFER_FACET_LABEL) as OfferFacet[]).filter((f) => present.has(f));
  }, [offers]);

  function toggleFacet(f: OfferFacet) {
    setFacets((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  }

  // Filter — facets pakai AND (tiap facet aktif WAJIB ada), biar kombinasi
  // "tanpa kartu" + "bootstrapped boleh" beneran mempersempit, bukan melebar.
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return indexed
      .filter(({ offer, searchText }) => {
        if (category && offer.category !== category) return false;
        if (kind && offer.kind !== kind) return false;
        if (facets.length > 0 && !facets.every((f) => offer.facets.includes(f))) return false;
        if (q && !searchText.includes(q)) return false;
        return true;
      })
      .map(({ offer }) => offer);
  }, [indexed, search, category, kind, facets]);

  // Reset ke halaman 1 tiap filter berubah
  useEffect(() => setPage(1), [search, category, kind, facets]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const rangeFrom = (current - 1) * PAGE_SIZE + 1;
  const rangeTo = (current - 1) * PAGE_SIZE + pageItems.length;

  const isFiltered = search !== "" || category !== "" || kind !== "" || facets.length > 0;

  function resetFilters() {
    setSearch("");
    setCategory("");
    setKind("");
    setFacets([]);
  }

  if (offers.length === 0) {
    return (
      <EmptyDataPanel
        title="Direktori modal gratis lagi disusun"
        description="Kurasi manual belum ke-publish — nyusul minggu ini."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Search ── */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari penawaran, vendor, atau kuota — Vercel, database, domain…"
          aria-label="Cari modal gratis"
          className="w-full rounded-[8px] border border-ink-line bg-ink-soft py-3.5 pl-11 pr-4 text-sm text-fog placeholder:text-mute focus:border-fog/40 focus:outline-none focus:ring-2 focus:ring-fog/70 transition-colors"
        />
      </div>

      {/* ── Category chips ── */}
      {availableCategories.length > 0 && (
        <div className="-mx-1 flex flex-wrap items-center gap-2 px-1">
          <Chip active={category === ""} onClick={() => setCategory("")}>
            Semua kategori
          </Chip>
          {availableCategories.map((c) => (
            <Chip
              key={c}
              active={category === c}
              onClick={() => setCategory(category === c ? "" : c)}
            >
              {OFFER_CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
      )}

      {/* ── Kind chips ── */}
      {availableKinds.length > 0 && (
        <div className="-mx-1 flex flex-wrap items-center gap-2 px-1">
          <Chip active={kind === ""} onClick={() => setKind("")}>
            Semua bentuk
          </Chip>
          {availableKinds.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? "" : k)}>
              {OFFER_KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
      )}

      {/* ── Facet chips — fitur andalan: kombinasi filter cepat ── */}
      {availableFacets.length > 0 && (
        <div className="-mx-1 px-1">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-mute">
            Filter cepat
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {availableFacets.map((f) => (
              <Chip key={f} active={facets.includes(f)} onClick={() => toggleFacet(f)}>
                {OFFER_FACET_LABEL[f]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* ── Grid / empty state ── */}
      {results.length === 0 ? (
        <div className="overflow-hidden rounded-[8px] border border-ink-line bg-ink-soft">
          <NoResultsPanel
            message="Ga ada penawaran yang cocok sama filter ini."
            hint="Coba hapus beberapa filter atau ganti kata kunci."
            onReset={resetFilters}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((o, i) => (
            <OfferCard key={o.slug} offer={o} priority={current === 1 && i < 3} />
          ))}
        </div>
      )}

      {/* ── Footer: count + pagination ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mute">
          {results.length === 0 ? (
            <>
              Menampilkan <span className="font-semibold text-fog">0</span> dari{" "}
              <span className="font-semibold text-fog">{offers.length}</span> penawaran
            </>
          ) : totalPages === 1 ? (
            <>
              Menampilkan{" "}
              <span className="font-semibold text-fog">
                {isFiltered ? results.length : offers.length}
              </span>
              {isFiltered && (
                <>
                  {" "}dari{" "}
                  <span className="font-semibold text-fog">{offers.length}</span>
                </>
              )}{" "}
              penawaran
            </>
          ) : (
            <>
              Menampilkan{" "}
              <span className="font-semibold text-fog">
                {rangeFrom}–{rangeTo}
              </span>{" "}
              dari <span className="font-semibold text-fog">{results.length}</span> penawaran
            </>
          )}
        </p>

        <Pagination
          current={current}
          total={totalPages}
          onChange={setPage}
          ariaLabel="Navigasi halaman modal gratis"
        />
      </div>
    </div>
  );
}
