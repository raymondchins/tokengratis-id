// Data model tokengratis.id.
// ATURAN ANTI-HALUSINASI: HANYA simpan field yang BENERAN ada di sumber.
// Sumber (mnfst/awesome-free-llm-apis data.json) nyediain data level
// provider + model. Field yang ga ada di sumber (butuh CC, butuh HP, akses
// Indonesia, expiry terstruktur) SENGAJA ga di-model — info kayak gitu yang
// kebetulan ditulis di prosa tetep utuh di `description` (apa adanya).

export type ProviderCategory = "provider_api" | "inference_provider";

/** Facet kemampuan, di-derive dari string modality tiap model di sumber. */
export type Modality =
  | "text"
  | "vision"
  | "image"
  | "audio"
  | "video"
  | "code"
  | "embeddings"
  | "reranking";

export interface Model {
  id: string;
  name: string;
  /** Context window apa adanya dari sumber, mis. "256K". null = ga ditulis. */
  context: string | null;
  maxOutput: string | null;
  /** String modality mentah dari sumber, mis. "Text + Vision". */
  modality: string;
  /** Rate limit apa adanya, mis. "200 RPM, 10 RPS". null = ga ditulis. */
  rateLimit: string | null;
}

export interface SourceRef {
  name: string;
  url: string;
}

export interface Provider {
  slug: string;
  name: string;
  category: ProviderCategory;
  /** ISO-2 country code (HQ provider — BUKAN ketersediaan akses). */
  country: string;
  flag: string;
  /** Registrable domain provider (buat logo). null kalau ga ke-derive. */
  domain: string | null;
  /** URL favicon/logo provider. null kalau ga ada domain. Fallback UI = flag. */
  logo: string | null;
  /** Halaman daftar / ambil API key. */
  url: string | null;
  /** Base URL API (buat dipanggil developer). */
  baseUrl: string | null;
  /** Teks deskripsi apa adanya dari sumber (sering memuat catatan CC/expiry/region). */
  description: string;

  /** Facet kemampuan provider (union dari modality semua model-nya). */
  modalities: Modality[];
  modelCount: number;
  /** Context window terbesar di antara model-nya, mis. "1M". null = ga ada data. */
  maxContext: string | null;
  /** Ringkasan "sampe sejauh apa gratisnya", di-derive dari `description`. */
  freeLimit: string | null;
  /** Catatan "+N model lain" dari sumber (entri non-model). null kalau ga ada. */
  moreModels: string | null;

  models: Model[];

  /** Atribusi sumber (WAJIB) + kapan di-sync. */
  source: SourceRef;
  syncedAt: string;
  /** Tanggal `lastUpdated` yang ditulis sumber. null kalau ga ada. */
  sourceUpdatedAt: string | null;
}
