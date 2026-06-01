import type { Modality, ProviderCategory, SourceRef } from "@/lib/types";

// ─── CategoryTag ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  provider_api: "Provider API",
  inference_provider: "Inference",
};

export function CategoryTag({ category }: { category: ProviderCategory }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-ink-line bg-ink px-2 py-0.5 text-[11px] font-medium text-mute">
      {CATEGORY_LABELS[category]}
    </span>
  );
}

// ─── Modality tags ──────────────────────────────────────────────────────────

const MODALITY_LABELS: Record<Modality, string> = {
  text: "Text",
  vision: "Vision",
  image: "Image",
  audio: "Audio",
  video: "Video",
  code: "Code",
  embeddings: "Embeddings",
  reranking: "Reranking",
};

export const MODALITY_ORDER: Modality[] = [
  "text",
  "vision",
  "image",
  "audio",
  "video",
  "code",
  "embeddings",
  "reranking",
];

export function modalityLabel(m: Modality): string {
  return MODALITY_LABELS[m];
}

export function ModalityTags({ modalities }: { modalities: Modality[] }) {
  const sorted = MODALITY_ORDER.filter((m) => modalities.includes(m));
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((m) => (
        <span
          key={m}
          className="inline-flex items-center rounded border border-grape-line bg-grape-bg px-1.5 py-0.5 text-[10px] font-medium text-grape"
        >
          {MODALITY_LABELS[m]}
        </span>
      ))}
    </div>
  );
}

// ─── Source attribution ───────────────────────────────────────────────────────

function fmtDate(iso: string): string {
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

export function SourceLine({
  source,
  syncedAt,
  linkless = false,
}: {
  source: SourceRef;
  syncedAt: string;
  linkless?: boolean;
}) {
  return (
    <span className="text-[11px] leading-relaxed text-mute">
      Disinkron {fmtDate(syncedAt)} dari{" "}
      {linkless ? (
        <span className="underline decoration-ink-line underline-offset-2">
          {source.name}
        </span>
      ) : (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-ink-line underline-offset-2 transition-colors hover:text-fog"
        >
          {source.name}
        </a>
      )}
    </span>
  );
}
