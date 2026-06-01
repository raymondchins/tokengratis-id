"use client";

import type { FilterState } from "@/lib/data";
import type { Category, OfferType } from "@/lib/types";

// ─── Label maps ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<Category, string> = {
  llm: "LLM",
  embeddings: "Embeddings",
  image: "Image",
  audio: "Audio",
  agent: "Agent",
};

const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  free_tier: "Free tier",
  free_credits: "Free credits",
  trial: "Trial",
};

const ALL_CATEGORIES: Category[] = ["llm", "embeddings", "image", "audio", "agent"];
const ALL_OFFER_TYPES: OfferType[] = ["free_tier", "free_credits", "trial"];

// ─── Chip primitive ──────────────────────────────────────────────────────────

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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-ember bg-ember/15 text-ember"
          : "border-ink-line bg-ink-soft text-mute hover:border-mute hover:text-fog",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ─── FilterBar ───────────────────────────────────────────────────────────────

export default function FilterBar({
  state,
  onChange,
}: {
  state: FilterState;
  onChange: (next: FilterState) => void;
}) {
  function toggleCategory(cat: Category) {
    const has = state.categories.includes(cat);
    onChange({
      ...state,
      categories: has
        ? state.categories.filter((c) => c !== cat)
        : [...state.categories, cat],
    });
  }

  function toggleOfferType(type: OfferType) {
    const has = state.offerTypes.includes(type);
    onChange({
      ...state,
      offerTypes: has
        ? state.offerTypes.filter((t) => t !== type)
        : [...state.offerTypes, type],
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <input
        type="search"
        value={state.search}
        onChange={(e) => onChange({ ...state, search: e.target.value })}
        placeholder="Cari provider atau model..."
        className="w-full rounded-lg border border-ink-line bg-ink-soft px-4 py-2.5 text-sm text-fog placeholder:text-mute focus:border-ember/60 focus:outline-none focus:ring-1 focus:ring-ember/30 transition-colors"
      />

      {/* Priority toggles */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-mute">
          Filter utama
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={state.indonesiaAccessibleOnly}
            onClick={() =>
              onChange({ ...state, indonesiaAccessibleOnly: !state.indonesiaAccessibleOnly })
            }
          >
            ✅ Bisa diakses dari Indonesia
          </Chip>
          <Chip
            active={state.noCreditCard}
            onClick={() => onChange({ ...state, noCreditCard: !state.noCreditCard })}
          >
            Tanpa kartu kredit
          </Chip>
          <Chip
            active={state.noPhone}
            onClick={() => onChange({ ...state, noPhone: !state.noPhone })}
          >
            Tanpa verif HP
          </Chip>
        </div>
      </div>

      {/* Category multi-select */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-mute">
          Kategori
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              active={state.categories.includes(cat)}
              onClick={() => toggleCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </Chip>
          ))}
        </div>
      </div>

      {/* OfferType multi-select */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-mute">
          Tipe offer
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_OFFER_TYPES.map((type) => (
            <Chip
              key={type}
              active={state.offerTypes.includes(type)}
              onClick={() => toggleOfferType(type)}
            >
              {OFFER_TYPE_LABELS[type]}
            </Chip>
          ))}
        </div>
      </div>

      {/* API toggle */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-mute">
          Akses
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={state.apiOnly}
            onClick={() => onChange({ ...state, apiOnly: !state.apiOnly })}
          >
            API tersedia
          </Chip>
        </div>
      </div>
    </div>
  );
}
