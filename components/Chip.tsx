"use client";

/** Pill toggle button — dipakai buat filter chip (modality directory, bahasa opensource). */
export default function Chip({
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
        "inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border px-4 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70",
        active
          ? "border-mute/60 bg-ink-line/70 text-fog"
          : "border-ink-line bg-ink-soft text-mute hover:border-mute hover:text-fog",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
