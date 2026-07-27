"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "next-view-transitions";
import {
  filterProviders,
  emptyFilter,
  sortProviders,
  SORT_LABELS,
  type FilterState,
  type SortKey,
} from "@/lib/filter";
import type { Modality, ProviderListItem } from "@/lib/types";
import { DIRECTORY_GRID_COLS, DIRECTORY_PAGE_SIZE } from "@/lib/constants";
import FilterBar from "@/components/directory/FilterBar";
import {
  CategoryTag,
  ModalityTags,
  MODALITY_ORDER,
  modalityLabel,
} from "@/components/directory/Badges";
import ProviderLogo from "@/components/ProviderLogo";
import Pagination from "@/components/Pagination";
import EmptyDataPanel from "@/components/EmptyDataPanel";
import NoResultsPanel from "@/components/NoResultsPanel";

// Kelas dipakai bareng mobile & desktop biar dua render tetap satu treatment.
const NAME_LINK =
  "group/name flex min-h-[44px] min-w-0 items-center gap-3 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70";
// CTA sekunder: putih + garis, BUKAN hitam. 49 tombol hitam di satu halaman
// bikin "satu aksi = satu hitam" (DESIGN.md) ga ada artinya. Affordance-nya
// tetap kebawa row hover (bg-ink/40) + border yang gelap pas hover.
const CTA_SECONDARY =
  "inline-flex min-h-[44px] shrink-0 items-center rounded-[6px] border border-ink-line bg-ink-soft px-4 text-sm font-semibold text-fog transition-colors group-hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70";

function ProviderRow({ p, priority = false }: { p: ProviderListItem; priority?: boolean }) {
  const ariaLabel = `${p.name} — ${p.modelCount} model${p.freeLimit ? `, gratis ${p.freeLimit}` : ""}`;
  const href = `/provider/${p.slug}`;

  // Kuitansi buat sel GRATIS yang kosong. JANGAN em dash: "—" kebaca "kita udah
  // cek, hasilnya nihil" — padahal pipeline cuma ngisi freeLimit kalau sumber
  // nulis eksplisit. Kita aggregator, bukan verifier, jadi tunjuk sumbernya.
  const noFreeInfo =
    p.sources.length > 0 ? (
      <a
        href={p.sources[0].url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center rounded-[2px] text-[11px] font-normal text-mute no-underline decoration-ink-line underline-offset-2 transition-colors hover:text-fog hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
      >
        Ga ada di sumber
      </a>
    ) : null;

  return (
    <>
      {/* ── Mobile card (hidden on md+) ── */}
      {/* Row-nya <div>, BUKAN <a>. Kuitansi "Ga ada di sumber" itu anchor ke
          sumber aslinya, dan <a> di dalam <a> itu HTML invalid — browser
          diem-diem nge-unnest dan link row-nya mati. Jadi link dipindah ke blok
          identitas provider + tombol "Lihat"; ring-inset row diganti ring
          per-link + focus-within biar highlight barisnya tetap kelihatan pas
          keyboard. */}
      <div className="group flex flex-col gap-3 border-t border-ink-line px-4 py-4 transition-colors hover:bg-ink/40 focus-within:bg-ink/40 md:hidden">
        {/* Logo + name + meta (target navigasi utama di mobile) */}
        <Link href={href} aria-label={ariaLabel} className={NAME_LINK}>
          <ProviderLogo logo={p.logo} flag={p.flag} name={p.name} className="h-10 w-10 shrink-0" priority={priority} />
          <div className="min-w-0">
            <span className="block truncate font-semibold text-fog underline-offset-2 decoration-ink-line group-hover/name:underline">
              {p.name}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-mute">{p.modelCount} model</span>
              <CategoryTag category={p.category} />
            </div>
          </div>
        </Link>

        {/* Gratis (free-tier amount) — absen = ga dirender sama sekali.
            Di mobile ga ada kolom bergaris, jadi absennya udah kebaca bener
            tanpa perlu kuitansi "Ga ada di sumber" kayak di desktop. */}
        {p.freeLimit && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-mute">Gratis:</span>
            <span className="font-semibold text-grass">{p.freeLimit}</span>
          </div>
        )}

        {/* Description */}
        {p.description && (
          <p className="line-clamp-2 text-[13px] leading-snug text-mute">{p.description}</p>
        )}

        {/* Modality icons + Lihat button */}
        <div className="flex items-center justify-between gap-3">
          <ModalityTags modalities={p.modalities} />
          <Link href={href} aria-label={`Lihat ${p.name}`} className={CTA_SECONDARY}>
            Lihat
          </Link>
        </div>
      </div>

      {/* ── Desktop grid row (hidden below md) ── */}
      <div
        className={`group hidden border-t border-ink-line py-4 transition-colors hover:bg-ink/40 focus-within:bg-ink/40 md:grid ${DIRECTORY_GRID_COLS}`}
      >
        {/* Provider */}
        <Link href={href} aria-label={ariaLabel} className={NAME_LINK}>
          <ProviderLogo logo={p.logo} flag={p.flag} name={p.name} className="h-9 w-9 shrink-0" priority={priority} />
          <div className="min-w-0">
            <span className="block truncate font-semibold text-fog underline-offset-2 decoration-ink-line group-hover/name:underline">
              {p.name}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[11px] text-mute">{p.modelCount} model</span>
              <CategoryTag category={p.category} />
            </div>
          </div>
        </Link>

        {/* Kemampuan */}
        <div className="min-w-0">
          <ModalityTags modalities={p.modalities} />
        </div>

        {/* Gratis (free-tier amount) */}
        <div className="min-w-0 text-sm font-semibold">
          {p.freeLimit ? (
            <span className="text-grass"><span className="sr-only">Gratis: </span>{p.freeLimit}</span>
          ) : (
            noFreeInfo
          )}
        </div>

        {/* Catatan. description absen = sel dibiarin kosong; di tabel bergaris
            sel kosong udah kebaca "ga disediain sumber".
            SENGAJA tanpa SourceLine: 24 baris × 3-4 nama sumber bikin tiap row
            ~3x lebih tinggi dan atribusinya identik di hampir semua baris —
            kuitansi lengkap ada di /provider/[slug], plus "Last update" di atas
            tabel & daftar sumber di footer. */}
        <div className="min-w-0">
          {p.description && (
            <p className="line-clamp-2 text-[13px] leading-snug text-mute">
              {p.description}
            </p>
          )}
        </div>

        {/* Aksi */}
        <div className="flex min-w-0 justify-end">
          <Link href={href} aria-label={`Lihat ${p.name}`} className={CTA_SECONDARY}>
            Lihat
          </Link>
        </div>
      </div>
    </>
  );
}

export default function DirectoryClient({ items }: { items: ProviderListItem[] }) {
  const [filter, setFilter] = useState<FilterState>(emptyFilter());
  const [sort, setSort] = useState<SortKey>("popular");
  const [page, setPage] = useState(1);

  // ── URL sync: filter/sort/page shareable + tahan refresh ───────────────────
  // Situs ini 100% static (SSG) — useSearchParams/useRouter maksa dynamic render
  // + Suspense, jadi kita main langsung ke window.history. State awal SENGAJA
  // tetap default biar HTML server & render client pertama identik (zero
  // hydration mismatch); nilai dari URL baru di-apply SETELAH mount.
  const urlRead = useRef(false);

  // Mount sekali: baca URL, validasi tiap param. Param ga dikenal / invalid
  // di-abaikan diem-diem (ga bikin error, ga bikin state aneh).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);

    const q = sp.get("q") ?? "";
    const mods = (sp.get("m") ?? "")
      .split(",")
      .filter((m): m is Modality => MODALITY_ORDER.includes(m as Modality))
      .filter((m, i, arr) => arr.indexOf(m) === i);
    if (q || mods.length > 0) setFilter({ search: q, modalities: mods });

    const s = sp.get("sort");
    if (s && (Object.keys(SORT_LABELS) as string[]).includes(s)) {
      setSort(s as SortKey);
    }

    const p = Number(sp.get("page"));
    if (Number.isInteger(p) && p > 1) setPage(p);

    urlRead.current = true;
  }, []);

  // Tulis state balik ke URL. replaceState, BUKAN pushState — ganti filter
  // jangan numpuk history bikin tombol back mampet. Param yang masih default
  // di-omit biar URL bersih tetap bersih ("/" bukan "/?sort=popular&page=1").
  // Debounce 200ms: ngetik di search bisa manggil replaceState puluhan kali
  // (Safari throttle ~100 call / 30 detik).
  useEffect(() => {
    if (!urlRead.current) return; // jangan nimpa URL sebelum mount-read kelar
    const t = setTimeout(() => {
      const sp = new URLSearchParams();
      const q = filter.search.trim();
      if (q) sp.set("q", q);
      if (filter.modalities.length > 0) sp.set("m", filter.modalities.join(","));
      if (sort !== "popular") sp.set("sort", sort);
      if (page > 1) sp.set("page", String(page));
      const qs = sp.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
      );
    }, 200);
    return () => clearTimeout(t);
  }, [filter, sort, page]);

  const results = useMemo(
    () => sortProviders(filterProviders(items, filter), sort),
    [items, filter, sort],
  );

  // Reset ke hal 1 tiap filter/sort berubah. Sengaja di handler, BUKAN
  // useEffect([filter, sort]) — effect bakal ikut nyala pas URL di-apply waktu
  // mount dan langsung ngebuang ?page= yang barusan dibaca.
  function changeFilter(next: FilterState) {
    setFilter(next);
    setPage(1);
  }
  function changeSort(next: SortKey) {
    setSort(next);
    setPage(1);
  }

  const availableModalities = useMemo<Modality[]>(() => {
    const present = new Set(items.flatMap((p) => p.modalities));
    return MODALITY_ORDER.filter((m) => present.has(m));
  }, [items]);

  // Angka di chip = jumlah provider di HASIL SEKARANG yang punya modality itu.
  // Karena filter modality-nya AND, angka itu persis "kalau chip ini gw klik,
  // sisanya berapa" — jadi perilaku AND-nya kejelasan sendiri tanpa tooltip.
  // Dihitung dari `results` (post-filter, pre-pagination), bukan `pageItems`.
  const modalityCounts = useMemo<Partial<Record<Modality, number>>>(() => {
    const counts: Partial<Record<Modality, number>> = {};
    for (const m of availableModalities) counts[m] = 0;
    for (const p of results) {
      for (const m of p.modalities) {
        if (counts[m] !== undefined) counts[m] = (counts[m] ?? 0) + 1;
      }
    }
    return counts;
  }, [results, availableModalities]);

  // Search dihitung 1 filter (bukan per-kata) — angkanya buat badge "reset".
  const activeCount = filter.modalities.length + (filter.search.trim() ? 1 : 0);

  // Label filter aktif buat NoResultsPanel: nyebut PENYEBABNYA biar user bisa
  // lepas satu, bukan cuma dikasih tombol nuke-semua. Search dikutip biar
  // kebedain dari nama modality.
  const activeLabels = useMemo<string[]>(() => {
    const labels = filter.modalities.map(modalityLabel);
    const q = filter.search.trim();
    return q ? [...labels, `"${q}"`] : labels;
  }, [filter]);

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
      <EmptyDataPanel
        title="Direktori lagi dibangun"
        description="Pipeline sync nyusul — data dari sumber komunitas lagi diproses."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        state={filter}
        onChange={changeFilter}
        availableModalities={availableModalities}
        modalityCounts={modalityCounts}
        activeCount={activeCount}
        onReset={() => changeFilter(emptyFilter())}
        rightSlot={
          <label className="flex items-center gap-2 text-sm text-mute">
            Urutkan
            <select
              value={sort}
              onChange={(e) => changeSort(e.target.value as SortKey)}
              className="min-h-[44px] rounded-[4px] border border-ink-line bg-ink-soft px-3 py-1.5 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
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
        {results.length === 0 ? (
          <NoResultsPanel
            message="Ga ada yang cocok sama filter ini."
            hint="Coba hapus beberapa filter atau ganti kata kunci."
            onReset={() => changeFilter(emptyFilter())}
            activeLabels={activeLabels}
          />
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop header row — aria-hidden, hidden below md; tiap row adalah satu link.
                ProviderRow sendiri yang switch mobile-card vs desktop-grid responsif. */}
            <div
              aria-hidden="true"
              className={`hidden md:grid ${DIRECTORY_GRID_COLS} py-3 text-[11px] font-semibold uppercase tracking-wider text-mute`}
            >
              <span>Provider</span>
              <span>Kemampuan</span>
              <span>Gratis</span>
              <span>Catatan</span>
              <span className="text-right">Aksi</span>
            </div>
            {pageItems.map((p, i) => (
              <ProviderRow key={p.slug} p={p} priority={current === 1 && i < 3} />
            ))}
          </div>
        )}
      </div>

      {/* Count (kiri) + pagination (kanan) — 1 baris */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* aria-live: jumlah hasil berubah tiap filter/sort/page — tanpa ini
            screen reader ga dikasih tau apa-apa pas user ngetik/klik chip.
            aria-atomic biar kalimatnya dibacain utuh, bukan angkanya doang. */}
        <p aria-live="polite" aria-atomic="true" className="text-sm text-mute">
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

        <Pagination
          current={current}
          total={totalPages}
          onChange={setPage}
          ariaLabel="Navigasi halaman direktori"
        />
      </div>
    </div>
  );
}
