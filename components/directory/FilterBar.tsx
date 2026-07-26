"use client";

import { emptyFilter, type FilterState } from "@/lib/filter";
import type { Modality } from "@/lib/types";
import { modalityLabel } from "./Badges";
import SearchIcon from "@/components/SearchIcon";
import Chip from "@/components/Chip";

export default function FilterBar({
  state,
  onChange,
  availableModalities,
  rightSlot,
}: {
  state: FilterState;
  onChange: (next: FilterState) => void;
  availableModalities: Modality[];
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

  const isAll = !state.search && state.modalities.length === 0;

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

      {/* Modality facets + slot kanan (sort)
           mobile: chip row 1 baris (scroll horizontal), sort di bawahnya
           sm+:    chip pills kiri wrap, sort kanan */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {/* Chip pills — tampil di SEMUA ukuran. Dulu mobile pakai <select> yang
            cuma bisa single-select (downgrade fungsi); chip = multi-select +
            udah bener keyboard/a11y-nya.
            Mobile kelebihan chip → scroll di DALAM baris ini doang, ga bikin
            halaman ikut scroll horizontal (dulu dua label dropdown sebaris ga
            muat di 375px dan bikin seluruh halaman geser).
            -m-1/p-1: overflow-x-auto bikin sumbu Y jadi auto juga, tanpa padding
            ini focus ring chip ke-clip. Margin negatifnya cuma makan padding
            <main> (px-4), jadi aman dari overflow. */}
        <div className="-m-1 flex items-center gap-2 overflow-x-auto p-1 sm:flex-wrap sm:overflow-visible">
          <Chip active={isAll} onClick={() => onChange(emptyFilter())}>
            Semua
          </Chip>

          {availableModalities.map((m) => (
            <Chip
              key={m}
              active={state.modalities.includes(m)}
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
    </div>
  );
}
