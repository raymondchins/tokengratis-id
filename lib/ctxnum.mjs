/**
 * Parse context-window string ("256K", "1M", "2B", "131K") jadi angka.
 * Dipakai buat sort "context terbesar" + nyari maxContext.
 *
 * Single source of truth: lib/ctxnum.ts (Next.js app) re-exports this file,
 * and scripts/lib/normalize.mjs (build pipeline, plain Node ESM — can't
 * import .ts) imports it directly via relative path. Plain JS + JSDoc so
 * both sides can consume it without a build step.
 *
 * @param {string | null} c
 * @returns {number}
 */
export function ctxNum(c) {
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
