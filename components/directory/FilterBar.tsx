"use client";

import type { FilterState } from "@/lib/filter";
import type { Modality } from "@/lib/types";
import { modalityLabel } from "./Badges";
import SearchIcon from "@/components/SearchIcon";
import Chip from "@/components/Chip";

export default function FilterBar({
  state,
  onChange,
  availableModalities,
  modalityCounts,
  activeCount,
  onReset,
  rightSlot,
}: {
  state: FilterState;
  onChange: (next: FilterState) => void;
  availableModalities: Modality[];
  /** Berapa hasil kalau chip ini diklik (semantik AND yang lagi jalan). */
  modalityCounts: Partial<Record<Modality, number>>;
  /** Jumlah filter yang lagi nyala (search ikut dihitung di parent). */
  activeCount: number;
  onReset: () => void;
  /** Slot opsional di ujung kanan baris chip (mis. kontrol sort). */
  rightSlot?: React.ReactNode;
}) {
  function toggleModality(m: Modality) {
    const has = state.modalities.includes(m);
    onChange({
      ...state,
      modalities: has
        ? state.modalities.filter((x) => x !== m)
        : [...state.modalities, m],
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
        <input
          type="search"
          value={state.search}
          onChange={(e) => onChange({ ...state, search: e.target.value })}
          placeholder="Cari provider atau model — Gemini, Groq, DeepSeek, Llama, Qwen…"
          aria-label="Cari provider atau model"
          className="w-full rounded-[8px] border border-ink-line bg-ink-soft py-3.5 pl-11 pr-4 text-sm text-fog placeholder:text-mute focus:border-fog/40 focus:outline-none focus:ring-2 focus:ring-fog/70 transition-colors"
        />
      </div>

      {/* Modality facets + slot kanan (sort) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        {/* WRAP di SEMUA breakpoint, bukan scroll horizontal.
            Sebelumnya baris ini `overflow-x-auto` di mobile: 769px chip dijejelin
            ke box 351px, jadi 5 dari 9 facet ga keliatan dan tombol clear-all
            nyangkut di left:-402px — escape hatch yang ga bisa dijangkau. Wrap
            makan ~3 baris vertikal di 375px, dan itu trade-off yang sengaja
            diambil: mending panjang ke bawah daripada filter ngumpet.
            Efek samping bagusnya: begitu overflow-x-auto ilang, sumbu Y ga jadi
            `auto` lagi → focus ring chip ga ke-clip → kompensasi `-m-1 p-1` yang
            dulu dipasang buat itu ikut dibuang. Margin negatif = satu lagi
            sumber overflow yang hilang.
            min-w-0 wajib: tanpa ini flex item bisa nolak ngecil dan ngedorong
            baris (persis bug 402px-di-343px yang dulu). Chip sendiri udah
            di-pagar `max-w-full`.
            role=group + aria-label: dulu user screen reader keluar dari field
            search langsung nyemplung ke "Semua, tombol" tanpa dikasih tau lagi
            masuk grup filter. */}
        <div
          role="group"
          aria-label="Filter kemampuan model"
          className="flex min-w-0 flex-wrap items-center gap-2"
        >
          {/* "Semua" = aksi RESET, bukan facet. Dulu dia <Chip aria-pressed>,
              alias tombol reset nyamar jadi toggle dan bohong ke assistive tech
              soal punya state on/off. Sekarang tombol biasa: no aria-pressed,
              bentuknya pill bulat + fill paper (pola "escape hatch" di
              DESIGN.md) biar jelas beda spesies dari chip multi-select yang
              kotak + putih. Sengaja GA di-disable pas ga ada filter — reset
              idempoten, kontrol mati cuma nambah bingung. */}
          <button
            type="button"
            onClick={onReset}
            aria-label="Hapus semua filter"
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-ink-line bg-ink px-4 py-2 text-[13px] font-medium text-mute transition-colors hover:border-mute hover:text-fog active:bg-ink-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
          >
            Semua
          </button>

          {/* Angka di chip = jumlah hasil KALAU chip ini diklik, di bawah
              semantik AND yang lagi jalan. Ini penjelasan AND-nya — begitu klik
              pertama, angka chip lain langsung turun/nol, jadi user ga perlu
              dibacain prosa dan ga kejebak numpuk filter sampe hasilnya kosong. */}
          {availableModalities.map((m) => (
            <Chip
              key={m}
              active={state.modalities.includes(m)}
              count={modalityCounts[m]}
              onClick={() => toggleModality(m)}
            >
              {modalityLabel(m)}
            </Chip>
          ))}
        </div>

        {/* Sort — mobile: baris sendiri di bawah chip; sm+: pojok kanan */}
        {rightSlot && (
          <div className="flex shrink-0 sm:justify-end">{rightSlot}</div>
        )}
      </div>

      {/* Ringkasan + reset yang SELALU keliatan pas ada filter nyala. Ini escape
          hatch yang sebenernya: posisinya ga tergantung scroll dan ga ikut
          ketutup baris chip. Sengaja kalem (12px, mute) — baris utilitas, bukan
          banner. Ga dikasih aria-live: DirectoryClient udah punya live region
          buat jumlah hasil, dua-duanya nyala = screen reader nyerocos dobel
          tiap klik chip. */}
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
