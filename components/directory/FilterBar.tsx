"use client";

import { emptyFilter, type FilterState } from "@/lib/filter";
import type { Modality } from "@/lib/types";
import { modalityLabel } from "./Badges";
import SearchIcon from "@/components/SearchIcon";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border px-4 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40",
        active
          ? "border-mute/60 bg-ink-line/70 text-fog"
          : "border-ink-line bg-ink-soft text-mute hover:border-mute hover:text-fog",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

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
          className="w-full rounded-[8px] border border-ink-line bg-ink-soft py-3.5 pl-11 pr-4 text-sm text-fog placeholder:text-mute focus:border-fog/40 focus:outline-none focus:ring-2 focus:ring-fog/30 transition-colors"
        />
      </div>

      {/* Chip row (modality facets) + slot kanan (sort)
           mobile: stacked (chips on top, sort below right-aligned)
           sm+:    side-by-side (chips left, sort right) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="-mx-1 flex flex-wrap items-center gap-2 px-1">
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

        {rightSlot && (
          <div className="flex shrink-0 justify-end">{rightSlot}</div>
        )}
      </div>
    </div>
  );
}
