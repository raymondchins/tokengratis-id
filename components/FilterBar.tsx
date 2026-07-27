"use client";

import { useId } from "react";
import SearchIcon from "@/components/SearchIcon";
import Chip from "@/components/Chip";

/**
 * SATU filter bar buat SEMUA permukaan list (`/`, `/pilih`, `/modal-gratis`,
 * `/opensource`). Sebelumnya tiap halaman punya tata bahasa interaksinya
 * sendiri — search di 3 dari 5, sort di 2 dari 5, chip 0-25 biji, reset cuma di
 * 1 — jadi apa pun yang user pelajarin di satu halaman ga kebawa ke halaman
 * berikutnya. Itu sumber rasa "ribet"-nya, bukan kepadatan datanya.
 *
 * Urutan render DIKUNCI: search -> grup chip -> sort -> "N filter aktif ·
 * Reset". Permukaan boleh ga punya sebagian (props opsional), TAPI ga boleh
 * nuker urutannya — posisi kontrol yang konsisten itu justru inti komponen ini.
 *
 * Gantiin `components/directory/FilterBar.tsx` yang lama (udah dihapus).
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
  /** true = label grup dirender visual (buat surface >1 grup). Default false. */
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
  /** Jumlah filter aktif. >0 → render baris "N filter aktif · Reset". */
  activeCount: number;
  onReset: () => void;
  /** Slot opsional di ujung kanan baris chip. */
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
  // Reset global. Pas cuma ada 1 grup dia duduk di awal baris chip (persis
  // tampilan direktori yang udah jalan); pas ada >1 grup dia dinaikin ke
  // barisnya sendiri — tombol yang nge-reset SEMUA grup ga boleh keliatan
  // (dan ke-announce) sebagai anggota salah satu grup.
  const singleGroup = chipGroups.length === 1;

  // "Semua" = aksi RESET, bukan facet. Dulu dia <Chip aria-pressed>, alias
  // tombol reset nyamar jadi toggle dan bohong ke assistive tech soal punya
  // state on/off. Sekarang tombol biasa: no aria-pressed, bentuknya pill bulat
  // + fill paper (pola "escape hatch" di DESIGN.md) biar jelas beda spesies
  // dari chip multi-select yang kotak + putih. Sengaja GA di-disable pas nol
  // filter — reset idempoten, kontrol mati cuma nambah bingung.
  const resetButton = (
    <button
      type="button"
      onClick={onReset}
      aria-label="Hapus semua filter"
      className="inline-flex min-h-[44px] shrink-0 items-center self-start rounded-full border border-ink-line bg-ink px-4 py-2 text-[13px] font-medium text-mute transition-colors hover:border-mute hover:text-fog active:bg-ink-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
    >
      Semua
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
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

      {/* 2. Grup chip + 3. sort (kanan di sm+, baris sendiri di mobile) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        {/* min-w-0 wajib: tanpa ini flex item bisa nolak ngecil dan ngedorong
            baris (persis bug 402px-di-343px yang dulu). */}
        <div className="flex min-w-0 flex-col gap-3">
          {!singleGroup && resetButton}

          {chipGroups.map((group) => {
            const labelId = `${uid}-${group.id}`;
            return (
              <div key={group.id} className="flex min-w-0 flex-col gap-1.5">
                {/* Label grup = jawaban buat masalah kepadatan. /modal-gratis
                    ngirim 25 chip dalam 3 grup; tanpa label itu satu gumpalan
                    25 chip yang ga bisa di-skim. Dipecah + dikasih judul, dia
                    jadi 3 himpunan ~8. Sengaja pakai peran Label DESIGN.md
                    (11px, mute, uppercase tracked) — ini header panel yang
                    STRUKTURAL, bukan eyebrow; ga boleh naik jadi heading.
                    Kalau labelnya keliatan, grup pakai aria-labelledby ke teks
                    itu (bukan aria-label) biar screen reader ga baca judul yang
                    sama dua kali. */}
                {group.showLabel && (
                  <span
                    id={labelId}
                    className="text-[11px] font-semibold uppercase tracking-[0.05em] text-mute"
                  >
                    {group.label}
                  </span>
                )}
                {/* WRAP di SEMUA breakpoint, bukan scroll horizontal.
                    overflow-x-auto pernah dicoba dan diukur di production: 769px
                    chip dijejelin ke box 351px, 5 dari 9 facet ilang dan tombol
                    reset nyangkut di left:-402px — escape hatch yang ga bisa
                    dijangkau. Wrap makan beberapa baris vertikal di 375px, dan
                    itu trade-off yang sengaja diambil. Efek samping bagusnya:
                    tanpa overflow-x, sumbu Y ga jadi `auto` → focus ring chip ga
                    ke-clip → ga butuh kompensasi `-m-1 p-1` (margin negatif =
                    satu lagi sumber overflow yang ga jadi ada).
                    role=group + label: tanpa ini user screen reader keluar dari
                    field search langsung nyemplung ke tombol pertama tanpa
                    dikasih tau lagi masuk grup filter yang mana. */}
                <div
                  role="group"
                  aria-label={group.showLabel ? undefined : group.label}
                  aria-labelledby={group.showLabel ? labelId : undefined}
                  className="flex min-w-0 flex-wrap items-center gap-2"
                >
                  {singleGroup && resetButton}
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
        </div>

        {(sort || rightSlot) && (
          <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
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

      {/* 4. Ringkasan + reset yang SELALU keliatan pas ada filter nyala. Ini
          escape hatch yang sebenernya: posisinya ga tergantung scroll dan ga
          ikut ketutup baris chip. Sengaja kalem (12px, mute) — baris utilitas,
          bukan banner. Ga dikasih aria-live: tiap permukaan udah punya live
          region sendiri buat jumlah hasil, dua-duanya nyala = screen reader
          nyerocos dobel tiap klik chip. */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-mute">
          <span>
            <span className="font-semibold text-fog">{activeCount}</span> filter
            aktif
          </span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-[44px] items-center rounded-[4px] px-1 font-medium text-fog underline decoration-ink-line underline-offset-4 transition-colors hover:decoration-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
