// Title + meta description halaman provider yang muat di potongan SERP Google.
// Single source of truth = lib/seo.mjs (plain JS, no imports) — ditulis .mjs
// biar bisa dicek langsung `node lib/seo.mjs --selftest` tanpa build step,
// pola yang sama kayak lib/ctxnum.mjs. Ubah logikanya di seo.mjs, bukan di sini.
export { providerSnippet, TITLE_MAX, DESC_MAX } from "./seo.mjs";

export interface ProviderSnippetInput {
  name: string;
  modelCount: number;
  maxContext?: string | null;
  modalityText?: string | null;
  syncedLabel?: string | null;
}

export interface ProviderSnippet {
  title: string;
  description: string;
}
