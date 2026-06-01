import type { Category, IndonesiaAccess, OfferType, SourceRef, Tristate } from "@/lib/types";

// ─── IndonesiaBadge ───────────────────────────────────────────────────────────

export function IndonesiaBadge({ status }: { status: IndonesiaAccess }) {
  if (status === "accessible") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#1a3a1a] bg-[#0d1f0d] px-2.5 py-0.5 text-xs font-medium text-[#4ade80]">
        ✅ Bisa diakses
      </span>
    );
  }
  if (status === "conditional") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#3a2e0a] bg-[#1f1a06] px-2.5 py-0.5 text-xs font-medium text-[#fbbf24]">
        ⚠️ Ada syarat
      </span>
    );
  }
  // unconfirmed
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ink-line bg-ink-soft px-2.5 py-0.5 text-xs font-medium text-mute">
      ❓ Belum dikonfirmasi
    </span>
  );
}

// ─── TristateBadge ───────────────────────────────────────────────────────────

export function TristateBadge({ label, value }: { label: string; value: Tristate }) {
  const valueEl =
    value === "yes" ? (
      <span className="text-[#4ade80]">Ya</span>
    ) : value === "no" ? (
      <span className="text-ember">Tidak</span>
    ) : (
      <span className="text-mute">Unknown</span>
    );

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fog">
      <span className="text-mute">{label}:</span>
      {valueEl}
    </span>
  );
}

// ─── CategoryTag ─────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<Category, string> = {
  llm: "LLM",
  embeddings: "Embeddings",
  image: "Image",
  audio: "Audio",
  agent: "Agent",
};

export function CategoryTag({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center rounded border border-ink-line bg-ink px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-mute">
      {CATEGORY_LABELS[category]}
    </span>
  );
}

// ─── OfferTypeTag ─────────────────────────────────────────────────────────────

const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  free_tier: "Free tier",
  free_credits: "Free credits",
  trial: "Trial",
};

export function OfferTypeTag({ type }: { type: OfferType }) {
  return (
    <span className="inline-flex items-center rounded border border-ember/30 bg-ember/10 px-2 py-0.5 text-[11px] font-medium text-ember">
      {OFFER_TYPE_LABELS[type]}
    </span>
  );
}

// ─── SyncedLabel ─────────────────────────────────────────────────────────────

function formatSyncDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function SyncedLabel({
  sources,
  syncedAt,
  linkless = false,
}: {
  sources: SourceRef[];
  syncedAt: string;
  /** When rendered inside another <a> (e.g. OfferCard), avoid nested anchors. */
  linkless?: boolean;
}) {
  return (
    <p className="text-[11px] leading-relaxed text-mute">
      Synced {formatSyncDate(syncedAt)} dari{" "}
      {sources.map((src, i) => (
        <span key={src.url}>
          {i > 0 && <span className="mx-0.5 text-ink-line">,</span>}
          {linkless ? (
            <span className="underline decoration-ink-line underline-offset-2">
              {src.name}
            </span>
          ) : (
            <a
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-ink-line underline-offset-2 transition-colors hover:text-fog hover:decoration-mute"
            >
              {src.name}
            </a>
          )}
        </span>
      ))}
    </p>
  );
}
