import { Link } from "next-view-transitions";

/**
 * Panel "belum ada data sama sekali" — kondisi pipeline belum pernah sync
 * (items.length === 0), beda sama "no results" (filter ga match). Copy
 * dilempar via props biar tiap listing (provider vs proyek) bisa beda kata.
 * `action` opsional — kasih jalan keluar (mis. balik ke direktori) daripada
 * nge-dead-end pengunjung.
 */
export default function EmptyDataPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[8px] border border-ink-line bg-ink-soft px-8 py-20 text-center">
      <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-grass-solid" />
      <p className="mt-4 text-base font-medium text-fog">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-mute">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-[6px] border border-ink-line bg-ink px-5 py-3 text-sm font-medium text-fog transition-colors hover:border-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
