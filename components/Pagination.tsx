"use client";

import { pageNumbers } from "@/lib/pagination";

/**
 * Prev/number/Next pagination nav — dipakai directory & opensource list.
 * Ga render apa-apa kalau cuma 1 halaman (samain behavior sama caller lama
 * yang wrap `{totalPages > 1 && <nav>...}`).
 */
export default function Pagination({
  current,
  total,
  onChange,
  ariaLabel,
}: {
  current: number;
  total: number;
  onChange: (page: number) => void;
  ariaLabel: string;
}) {
  if (total <= 1) return null;

  return (
    <nav aria-label={ariaLabel} className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(current - 1)}
        disabled={current <= 1}
        aria-label="Halaman sebelumnya"
        className="min-h-[40px] rounded-[6px] border border-ink-line bg-ink-soft px-3 py-2 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Prev
      </button>
      {pageNumbers(current, total).map((n, i) =>
        n === "…" ? (
          <span
            key={`gap-${i}`}
            aria-hidden="true"
            className="min-h-[40px] px-1.5 py-2 text-sm text-mute"
          >
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`Halaman ${n}`}
            aria-current={n === current ? "page" : undefined}
            className={`min-h-[40px] min-w-[40px] rounded-[6px] border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 ${
              n === current
                ? "border-ember bg-ember text-white"
                : "border-ink-line bg-ink-soft text-mute hover:border-mute hover:text-fog"
            }`}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(current + 1)}
        disabled={current >= total}
        aria-label="Halaman berikutnya"
        className="min-h-[40px] rounded-[6px] border border-ink-line bg-ink-soft px-3 py-2 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next →
      </button>
    </nav>
  );
}
