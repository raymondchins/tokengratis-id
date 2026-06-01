import type { Modality, ProviderCategory, SourceRef } from "@/lib/types";

// ─── CategoryTag ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  provider_api: "Provider API",
  inference_provider: "Inference",
};

export function CategoryTag({ category }: { category: ProviderCategory }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-[2px] border border-ink-line bg-ink px-2 py-0.5 text-[11px] font-medium text-mute">
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

/** Warna icon per modality — beda hue biar gampang dibedain sekilas. */
const MODALITY_COLOR: Record<Modality, string> = {
  text: "text-[#475569]", // slate
  vision: "text-[#2563eb]", // blue
  image: "text-[#0d7a56]", // green (darkened for AA contrast)
  audio: "text-[#b45309]", // amber (darkened for AA contrast)
  video: "text-[#e11d48]", // rose
  code: "text-[#7c3aed]", // violet
  embeddings: "text-[#0891b2]", // cyan
  reranking: "text-[#db2777]", // pink
};

/** Icon per modality (24x24, stroke = currentColor). Hemat space; teks via title hover. */
function ModalityIcon({ m }: { m: Modality }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-3.5 w-3.5",
    "aria-hidden": true,
  };
  switch (m) {
    case "text":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h12M4 17h8" />
        </svg>
      );
    case "vision":
      return (
        <svg {...common}>
          <path d="M2 12s3-6.5 10-6.5S22 12 22 12s-3 6.5-10 6.5S2 12 2 12z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="M21 16l-5-5L5 20" />
        </svg>
      );
    case "audio":
      return (
        <svg {...common}>
          <path d="M4 9v6h4l5 4V5L8 9H4z" />
          <path d="M16.5 9a4 4 0 010 6" />
        </svg>
      );
    case "video":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="M16 10l5-3v10l-5-3" />
        </svg>
      );
    case "code":
      return (
        <svg {...common}>
          <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
        </svg>
      );
    case "embeddings":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <circle cx="7" cy="7" r="2" />
          <circle cx="17" cy="7" r="2" />
          <circle cx="7" cy="17" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      );
    case "reranking":
      return (
        <svg {...common}>
          <path d="M7 5v14M7 5L4 8M7 5l3 3M17 19V5M17 19l-3-3M17 19l3-3" />
        </svg>
      );
  }
}

function ModalityChip({ m }: { m: Modality }) {
  return (
    <span
      title={MODALITY_LABELS[m]}
      aria-label={MODALITY_LABELS[m]}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-[2px] border border-ink-line bg-ink-soft transition-colors hover:border-mute ${MODALITY_COLOR[m]}`}
    >
      <ModalityIcon m={m} />
    </span>
  );
}

/**
 * `full` (detail page): flow horizontal, tampil semua, ga ada cap.
 * default (tabel direktori): grid 3 kolom × 2 baris (maks 6), sisanya "+N".
 */
export function ModalityTags({
  modalities,
  full = false,
}: {
  modalities: Modality[];
  full?: boolean;
}) {
  const sorted = MODALITY_ORDER.filter((m) => modalities.includes(m));

  if (full) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((m) => (
          <ModalityChip key={m} m={m} />
        ))}
      </div>
    );
  }

  const MAX = 6;
  const shown = sorted.length > MAX ? sorted.slice(0, MAX - 1) : sorted;
  const extra = sorted.slice(shown.length);

  return (
    <div className="grid w-fit grid-cols-3 gap-1">
      {shown.map((m) => (
        <ModalityChip key={m} m={m} />
      ))}
      {extra.length > 0 && (
        <span
          title={extra.map((m) => MODALITY_LABELS[m]).join(", ")}
          aria-label={`${extra.length} lagi: ${extra
            .map((m) => MODALITY_LABELS[m])
            .join(", ")}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-[2px] border border-ink-line bg-ink-soft text-[10px] font-semibold text-mute"
        >
          +{extra.length}
        </span>
      )}
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
  sources,
}: {
  sources: SourceRef[];
}) {
  if (sources.length === 0) return null;

  const maxSyncedAt = sources.reduce(
    (max, s) => (s.syncedAt > max ? s.syncedAt : max),
    sources[0].syncedAt,
  );

  function SourceName({ s }: { s: SourceRef }) {
    return (
      <a
        href={s.url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-ink-line underline-offset-2 transition-colors hover:text-fog"
      >
        {s.name}
      </a>
    );
  }

  if (sources.length === 1) {
    return (
      <span className="text-[11px] leading-relaxed text-mute">
        Disinkron {fmtDate(sources[0].syncedAt)} dari{" "}
        <SourceName s={sources[0]} />
      </span>
    );
  }

  return (
    <span className="text-[11px] leading-relaxed text-mute">
      Disinkron dari{" "}
      {sources.map((s, i) => (
        <span key={s.url}>
          <SourceName s={s} />
          {i < sources.length - 1 && <span>, </span>}
        </span>
      ))}
      {" · update terakhir "}
      {fmtDate(maxSyncedAt)}
    </span>
  );
}
