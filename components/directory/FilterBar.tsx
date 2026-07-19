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
           mobile: dua dropdown sebaris (Filter modality kiri, Urutkan kanan)
           sm+:    chip pills kiri, sort kanan */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {/* Desktop: chip pills */}
        <div className="-mx-1 hidden flex-wrap items-center gap-2 px-1 sm:flex">
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

        {/* Mobile: dropdown modality (single-select) + sort sebaris */}
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <label className="flex items-center gap-2 text-sm text-mute">
            Filter
            <select
              value={state.modalities[0] ?? ""}
              onChange={(e) =>
                onChange({
                  ...state,
                  modalities: e.target.value
                    ? [e.target.value as Modality]
                    : [],
                })
              }
              aria-label="Filter modality"
              className="rounded-[4px] border border-ink-line bg-ink-soft px-3 py-1.5 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40"
            >
              <option value="">Semua</option>
              {availableModalities.map((m) => (
                <option key={m} value={m}>
                  {modalityLabel(m)}
                </option>
              ))}
            </select>
          </label>
          {rightSlot}
        </div>

        {/* Desktop: sort */}
        {rightSlot && (
          <div className="hidden shrink-0 justify-end sm:flex">{rightSlot}</div>
        )}
      </div>
    </div>
  );
}
