"use client";

import { useEffect, useId, useRef, useState } from "react";
import SearchIcon from "@/components/SearchIcon";
import Chip from "@/components/Chip";

/**
 * SATU filter bar buat SEMUA permukaan list (`/`, `/pilih`, `/modal-gratis`,
 * `/opensource`). Sebelumnya tiap halaman punya tata bahasa interaksinya
 * sendiri, jadi apa pun yang user pelajarin di satu halaman ga kebawa.
 *
 * ── Kenapa default-nya TERTUTUP (revisi 2026-07-27) ──────────────────────────
 * Versi sebelumnya nampilin SEMUA chip sekaligus, dikelompokin + dikasih label.
 * Itu salah, dan salahnya ketahuan begitu diliat: /modal-gratis jadi 23 kotak
 * putih bergaris sekaligus, / jadi 10. Ngelompokin cuma NGERAPIHIN tembok,
 * bukan ngurangin bebannya.
 *
 * Cacat aslinya: desainnya KEBALIK. Chip yang BELUM dipilih teriak paling
 * kenceng (23 kotak dengan garis + fill), sementara yang UDAH dipilih justru
 * kalem. Praktik faceted search yang mapan kebalikannya — keadaan istirahat
 * tenang, keadaan terpilih tegas.
 *
 * Jadi sekarang:
 *   - istirahat  = search + satu tombol `Filter` + sort. Itu aja.
 *   - aktif      = pil filter yang bisa dicopot satu-satu + `Reset`, SELALU
 *                  keliatan tanpa perlu buka panel.
 *   - panel      = grup chip lengkap, cuma pas diminta.
 *
 * Panel-nya DISCLOSURE di alur normal, BUKAN popover: nol perhitungan posisi,
 * dan ga bisa ke-clip sama ancestor `overflow-hidden` (jebakan yang ditulis di
 * DESIGN.md). Di-MOUNT/UNMOUNT, bukan di-toggle lewat class — lihat INCIDENT
 * 2026-07-27 di docs/log.md, menu yang disembunyiin lewat transisi class pernah
 * ship dalam keadaan mati total dan semua sinyal build tetep hijau.
 *
 * Urutan render DIKUNCI: search -> baris kontrol (Filter + sort) -> pil aktif
 * -> panel. Permukaan boleh ga punya sebagian, TAPI ga boleh nuker urutannya.
 */

export type FilterChipOption = {
  id: string;
  label: string;
  /** Jumlah hasil kalau chip ini diklik. undefined = ga nampilin angka. */
  count?: number;
};

export type FilterChipGroup = {
  id: string;
  /** WAJIB — dipakai buat aria-label role="group". */
  label: string;
  /** true = label grup dirender visual di dalam panel. Default false. */
  showLabel?: boolean;
  options: FilterChipOption[];
  selected: string[];
  onToggle: (optionId: string) => void;
};

export type FilterBarProps = {
  /** undefined = surface ini ga punya search. */
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    /** aria-label */
    label: string;
  };
  chipGroups: FilterChipGroup[];
  /** undefined = ga ada sort. */
  sort?: {
    value: string;
    options: Record<string, string>; // key -> label
    onChange: (v: string) => void;
    /** Label visual di sebelah select. Default "Urutkan". */
    label?: string;
  };
  /** Jumlah filter aktif — dipakai di badge tombol Filter. */
  activeCount: number;
  onReset: () => void;
  /** Slot opsional di ujung kanan baris kontrol. */
  rightSlot?: React.ReactNode;
};

export default function FilterBar({
  search,
  chipGroups,
  sort,
  activeCount,
  onReset,
  rightSlot,
}: FilterBarProps) {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Escape nutup panel + balikin fokus ke tombolnya. Listener cuma nempel
  // selama panel kebuka. SENGAJA ga nutup pas klik di luar: ini disclosure di
  // alur normal (bukan overlay), dan nutup pas user ngeklik hasil di bawahnya
  // itu bikin kaget, bukan ngebantu.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const totalOptions = chipGroups.reduce((n, g) => n + g.options.length, 0);

  /** Pil filter aktif — diturunin dari chipGroups, bukan state kedua. */
  const activePills = chipGroups.flatMap((group) =>
    group.selected
      .map((id) => {
        const opt = group.options.find((o) => o.id === id);
        return opt ? { groupId: group.id, opt, onToggle: group.onToggle } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  );

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Search */}
      {search && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
          <input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.label}
            className="min-h-[44px] w-full rounded-[8px] border border-ink-line bg-ink-soft py-3.5 pl-11 pr-4 text-sm text-fog placeholder:text-mute transition-colors focus:border-fog/40 focus:outline-none focus:ring-2 focus:ring-fog/70"
          />
        </div>
      )}

      {/* 2. Baris kontrol — SATU tombol Filter + sort. Ini yang keliatan pas
             istirahat, dan cuma ini. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {totalOptions > 0 && (
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-[6px] border px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 ${
              open || activeCount > 0
                ? "border-mute bg-ink-sel font-semibold text-fog"
                : "border-ink-line bg-ink-soft text-mute hover:border-mute hover:text-fog"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M3 6h18M7 12h10M11 18h2" />
            </svg>
            Filter
            {activeCount > 0 && (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-fog px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white tabular-nums">
                {activeCount}
              </span>
            )}
            <span
              aria-hidden="true"
              className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          </button>
        )}

        {(sort || rightSlot) && (
          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3">
            {sort && (
              <label className="flex items-center gap-2 text-sm text-mute">
                {sort.label ?? "Urutkan"}
                <select
                  value={sort.value}
                  onChange={(e) => sort.onChange(e.target.value)}
                  className="min-h-[44px] rounded-[4px] border border-ink-line bg-ink-soft px-3 py-1.5 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
                >
                  {Object.entries(sort.options).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {rightSlot}
          </div>
        )}
      </div>

      {/* 3. Pil filter AKTIF. Ini pembalikan yang bikin desainnya bener: yang
             kepilih itu yang tegas dan bisa dicopot satu-satu, bukan yang belum
             kepilih. User ga perlu buka panel cuma buat tau lagi nyaring apa.
             Ga dikasih aria-live: tiap permukaan udah punya live region sendiri
             buat jumlah hasil; dua-duanya nyala = screen reader nyerocos dobel. */}
      {activePills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activePills.map(({ groupId, opt, onToggle }) => (
            <button
              key={`${groupId}-${opt.id}`}
              type="button"
              onClick={() => onToggle(opt.id)}
              aria-label={`Hapus filter ${opt.label}`}
              className="inline-flex min-h-[44px] max-w-full items-center gap-1.5 rounded-full border border-mute bg-ink-sel px-3.5 text-[13px] font-medium text-fog transition-colors hover:border-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
            >
              <span className="min-w-0 truncate">{opt.label}</span>
              <span aria-hidden="true" className="text-mute">
                ✕
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-[44px] items-center rounded-[4px] px-1 text-[12px] font-medium text-mute underline decoration-ink-line underline-offset-4 transition-colors hover:text-fog hover:decoration-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
          >
            Reset
          </button>
        </div>
      )}

      {/* 4. Panel — cuma pas diminta. Di-MOUNT/UNMOUNT (bukan class toggle):
             pas ketutup dia beneran ilang dari a11y tree & urutan tab, dan ga
             bisa nyangkut di computed style kayak INCIDENT menu mobile. */}
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          className="flex flex-col gap-4 rounded-[8px] border border-ink-line bg-ink-soft p-4"
        >
          {chipGroups.map((group) => {
            const labelId = `${uid}-${group.id}`;
            return (
              <div key={group.id} className="flex min-w-0 flex-col gap-1.5">
                {/* Peran Label DESIGN.md (11px, mute, uppercase tracked) — ini
                    header panel yang STRUKTURAL, bukan eyebrow. Kalau labelnya
                    keliatan, grup pakai aria-labelledby ke teks itu biar screen
                    reader ga baca judul yang sama dua kali. */}
                {group.showLabel && (
                  <span
                    id={labelId}
                    className="text-[11px] font-semibold uppercase tracking-[0.05em] text-mute"
                  >
                    {group.label}
                  </span>
                )}
                {/* WRAP, bukan scroll horizontal. overflow-x-auto pernah diukur
                    di production: 769px chip dijejelin ke box 351px, 5 dari 9
                    facet ilang. Di dalam panel, wrap aman — panel-nya emang
                    tempat semuanya boleh keliatan. */}
                <div
                  role="group"
                  aria-label={group.showLabel ? undefined : group.label}
                  aria-labelledby={group.showLabel ? labelId : undefined}
                  className="flex min-w-0 flex-wrap items-center gap-2"
                >
                  {group.options.map((opt) => (
                    <Chip
                      key={opt.id}
                      active={group.selected.includes(opt.id)}
                      count={opt.count}
                      onClick={() => group.onToggle(opt.id)}
                    >
                      {opt.label}
                    </Chip>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-3 border-t border-ink-line pt-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="inline-flex min-h-[44px] items-center rounded-[6px] border border-ink-line bg-ink px-4 text-[13px] font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
            >
              Tutup
            </button>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex min-h-[44px] items-center rounded-[4px] px-1 text-[12px] font-medium text-mute underline decoration-ink-line underline-offset-4 transition-colors hover:text-fog hover:decoration-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
              >
                Hapus semua filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
