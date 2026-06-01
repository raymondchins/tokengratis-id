/**
 * Parse context-window string ("256K", "1M", "2B", "131K") jadi angka.
 * Dipakai buat sort "context terbesar" + nyari maxContext.
 * NOTE: logika identik ada di scripts/sync.mjs (build script standalone, ga bisa
 * import TS) — kalau ubah di sini, ubah di sana juga.
 */
export function ctxNum(c: string | null): number {
  if (!c) return 0;
  const m = String(c).match(/([\d.]+)\s*([KkMmBb]?)/);
  if (!m) return 0;
  let n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u === "k") n *= 1e3;
  if (u === "m") n *= 1e6;
  if (u === "b") n *= 1e9;
  return n;
}
