"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Offer, OfferCategory, OfferFacet, OfferKind } from "@/lib/offer-types";
import {
  OFFER_CATEGORY_LABEL,
  OFFER_FACET_LABEL,
  OFFER_KIND_LABEL,
} from "@/lib/offer-types";
import FilterBar, { type FilterChipGroup } from "@/components/FilterBar";
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

  // ── URL state (shareable + refresh-safe) ──────────────────────────────────
  // Statis (SSG) — sengaja BUKAN useSearchParams/useRouter (itu maksa dynamic
  // rendering). Baca window.location manual sekali pas mount, tulis balik via
  // replaceState. skipNextPageResetRef nyegah efek "reset ke halaman 1 pas
  // filter berubah" (di bawah) nge-overwrite halaman yang baru di-restore dari
  // URL, TAPI cuma kalau hydration ini emang ngubah filter juga (kalau cuma
  // page doang yang di-restore, efek reset itu ga bakal ke-trigger sama
  // sekali, jadi ga butuh di-skip).
  const skipNextPageResetRef = useRef(false);
  const isFirstUrlSyncRef = useRef(true);

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

  // ── Angka di chip = "kalau chip ini gw klik, hasilnya berapa" ──────────────
  // Konvensi sama persis kayak direktori (/): dihitung dari hasil post-filter
  // pre-pagination, dan buat chip yang LAGI aktif angkanya = total hasil
  // sekarang. Hitungannya beda per grup, SENGAJA, ngikutin semantik grupnya:
  // kategori & bentuk itu single-select (klik = GANTI nilai, jadi filter grup
  // itu sendiri dikeluarin dari hitungan), facet itu AND multi-select (klik =
  // NAMBAH syarat, jadi cukup ngitung dari `results` apa adanya). Dataset-nya
  // kurasi manual (puluhan entri), jadi 3 pass lagi murah banget.
  const categoryCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const counts: Partial<Record<OfferCategory, number>> = {};
    for (const c of availableCategories) counts[c] = 0;
    for (const { offer, searchText } of indexed) {
      if (kind && offer.kind !== kind) continue;
      if (facets.length > 0 && !facets.every((f) => offer.facets.includes(f))) continue;
      if (q && !searchText.includes(q)) continue;
      if (counts[offer.category] !== undefined) {
        counts[offer.category] = (counts[offer.category] ?? 0) + 1;
      }
    }
    return counts;
  }, [indexed, availableCategories, search, kind, facets]);

  const kindCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const counts: Partial<Record<OfferKind, number>> = {};
    for (const k of availableKinds) counts[k] = 0;
    for (const { offer, searchText } of indexed) {
      if (category && offer.category !== category) continue;
      if (facets.length > 0 && !facets.every((f) => offer.facets.includes(f))) continue;
      if (q && !searchText.includes(q)) continue;
      if (counts[offer.kind] !== undefined) {
        counts[offer.kind] = (counts[offer.kind] ?? 0) + 1;
      }
    }
    return counts;
  }, [indexed, availableKinds, search, category, facets]);

  const facetCounts = useMemo(() => {
    const counts: Partial<Record<OfferFacet, number>> = {};
    for (const f of availableFacets) counts[f] = 0;
    for (const offer of results) {
      for (const f of offer.facets) {
        if (counts[f] !== undefined) counts[f] = (counts[f] ?? 0) + 1;
      }
    }
    return counts;
  }, [results, availableFacets]);

  // Reset ke halaman 1 tiap filter berubah
  useEffect(() => {
    if (skipNextPageResetRef.current) {
      skipNextPageResetRef.current = false;
      return;
    }
    setPage(1);
  }, [search, category, kind, facets]);

  // Hydrate dari query string sekali pas mount. Tiap value divalidasi ke
  // known-valid values — link basi (facet/kategori yang udah ga ada) di-drop
  // diam-diam, ga pernah nge-crash.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let filtersChanged = false;

    const qParam = params.get("q");
    if (qParam) {
      setSearch(qParam);
      filtersChanged = true;
    }

    const catParam = params.get("cat");
    if (catParam && (Object.keys(OFFER_CATEGORY_LABEL) as string[]).includes(catParam)) {
      setCategory(catParam as OfferCategory);
      filtersChanged = true;
    }

    const kindParam = params.get("kind");
    if (kindParam && (Object.keys(OFFER_KIND_LABEL) as string[]).includes(kindParam)) {
      setKind(kindParam as OfferKind);
      filtersChanged = true;
    }

    const facetsParam = params.get("f");
    if (facetsParam) {
      const validFacets = facetsParam
        .split(",")
        .filter((f): f is OfferFacet => (Object.keys(OFFER_FACET_LABEL) as string[]).includes(f));
      if (validFacets.length > 0) {
        setFacets(validFacets);
        filtersChanged = true;
      }
    }

    const pageParam = params.get("page");
    if (pageParam) {
      const n = Number(pageParam);
      if (Number.isInteger(n) && n > 0) {
        setPage(n);
        if (filtersChanged) skipNextPageResetRef.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronin state balik ke URL — replaceState (BUKAN pushState, ga nambah
  // history entry per klik filter). Ref-guard biar invocation pertama (yang
  // masih state default, sebelum efek hydrate di atas kelar) ga nge-clobber
  // URL yang baru masuk.
  useEffect(() => {
    if (isFirstUrlSyncRef.current) {
      isFirstUrlSyncRef.current = false;
      return;
    }
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (category) qs.set("cat", category);
    if (kind) qs.set("kind", kind);
    if (facets.length > 0) qs.set("f", facets.join(","));
    if (page > 1) qs.set("page", String(page));
    const query = qs.toString();
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [search, category, kind, facets, page]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const rangeFrom = (current - 1) * PAGE_SIZE + 1;
  const rangeTo = (current - 1) * PAGE_SIZE + pageItems.length;

  // Search dihitung 1 filter (bukan per-kata) — sama kayak direktori.
  const activeCount =
    (category ? 1 : 0) + (kind ? 1 : 0) + facets.length + (search.trim() ? 1 : 0);
  const isFiltered = activeCount > 0;

  function resetFilters() {
    setSearch("");
    setCategory("");
    setKind("");
    setFacets([]);
  }

  // Dipisah dari JSX (bukan literal inline) supaya array-nya beneran ke-anotasi
  // FilterChipGroup[] — kalau `.filter()` nempel langsung di literal, contextual
  // typing-nya putus dan param `onToggle` jatuh ke implicit any.
  const allChipGroups: FilterChipGroup[] = [
    // Single-select: klik chip lain = GANTI, klik chip yang aktif = lepas.
    {
      id: "kategori",
      label: "Jenis layanan",
      showLabel: true,
      options: availableCategories.map((c) => ({
        id: c,
        label: OFFER_CATEGORY_LABEL[c],
        count: categoryCounts[c],
      })),
      selected: category ? [category] : [],
      onToggle: (id) => setCategory(category === id ? "" : (id as OfferCategory)),
    },
    {
      id: "bentuk",
      label: "Bentuk penawaran",
      showLabel: true,
      options: availableKinds.map((k) => ({
        id: k,
        label: OFFER_KIND_LABEL[k],
        count: kindCounts[k],
      })),
      selected: kind ? [kind] : [],
      onToggle: (id) => setKind(kind === id ? "" : (id as OfferKind)),
    },
    // Multi-select AND — beda spesies dari dua grup di atas, dan justru itu yang
    // bikin label grup wajib ada.
    {
      id: "syarat",
      label: "Syarat & jebakan",
      showLabel: true,
      options: availableFacets.map((f) => ({
        id: f,
        label: OFFER_FACET_LABEL[f],
        count: facetCounts[f],
      })),
      selected: facets,
      onToggle: (id) => toggleFacet(id as OfferFacet),
    },
  ];
  const chipGroups = allChipGroups.filter((g) => g.options.length > 0);

  if (offers.length === 0) {
    return (
      <EmptyDataPanel
        title="Direktori modal gratis lagi disusun"
        description="Kurasi manual belum ke-publish — nyusul minggu ini."
        action={{ href: "/#direktori", label: "Kembali ke direktori" }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Filter ────────────────────────────────────────────────────────────
          FilterBar bareng — sama kayak /, /pilih, /opensource. Ini permukaan
          paling padat di situs (25 chip), dan dulu ketiganya nempel jadi satu
          gumpalan tanpa judul: user ga bisa nebak "Database" dan "Kredit
          sekali" itu dua sumbu yang beda. Makanya `showLabel` nyala di sini —
          25 chip jadi 3 himpunan bernama, bukan 25 pilihan sejajar.
          Chip "Semua kategori"/"Semua bentuk" per-grup DIBUANG: tombol reset
          global punya FilterBar udah nge-cover, dan ngedeselect satu grup tetep
          bisa lewat klik ulang chip yang aktif (toggle). */}
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Cari penawaran, vendor, atau kuota — Vercel, database, domain…",
          label: "Cari modal gratis",
        }}
        chipGroups={chipGroups}
        activeCount={activeCount}
        onReset={resetFilters}
      />

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
        <p className="text-sm text-mute" aria-live="polite">
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
