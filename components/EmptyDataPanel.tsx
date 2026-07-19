/**
 * Panel "belum ada data sama sekali" — kondisi pipeline belum pernah sync
 * (items.length === 0), beda sama "no results" (filter ga match). Copy
 * dilempar via props biar tiap listing (provider vs proyek) bisa beda kata.
 */
export default function EmptyDataPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[8px] border border-ink-line bg-ink-soft px-8 py-20 text-center">
      <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-grass-solid" />
      <p className="mt-4 text-base font-medium text-fog">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-mute">{description}</p>
    </div>
  );
}
