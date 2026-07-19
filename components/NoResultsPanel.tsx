/**
 * Panel "ga ada yang cocok sama filter" — beda sama EmptyDataPanel (itu buat
 * data kosong total). Copy + reset handler dilempar via props per-caller.
 */
export default function NoResultsPanel({
  message,
  hint,
  onReset,
}: {
  message: string;
  hint: string;
  onReset: () => void;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <p className="text-base font-medium text-fog">{message}</p>
      <p className="mt-2 text-sm text-mute">{hint}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 rounded-full border border-ink-line bg-ink px-5 py-2 text-sm font-medium text-fog transition-colors hover:border-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40"
      >
        Reset semua filter
      </button>
    </div>
  );
}
