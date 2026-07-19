// Parse context-window string ("256K", "1M", "2B", "131K") jadi angka.
// Dipakai buat sort "context terbesar" + nyari maxContext.
// Single source of truth = lib/ctxnum.mjs (plain JS, no imports) — dipakai
// juga langsung oleh scripts/lib/normalize.mjs (build pipeline, plain Node
// ESM, ga bisa import .ts). Ubah logikanya di ctxnum.mjs, bukan di sini.
export { ctxNum } from "./ctxnum.mjs";
