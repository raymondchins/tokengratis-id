// Data model tokengratis.id.
// ATURAN ANTI-HALUSINASI: HANYA simpan field yang BENERAN ada di sumber.
// Sumber-sumber (mnfst/awesome-free-llm-apis, freellm.net, cheahjs/free-llm-api-resources)
// nyediain data level provider + model. Field yang ga ada di sumber (butuh CC,
// butuh HP, akses Indonesia, expiry terstruktur) SENGAJA ga di-model — info kayak
// gitu yang kebetulan ditulis di prosa tetep utuh di `description` (apa adanya).
//
// MULTI-SUMBER: satu provider bisa di-aggregate dari >1 sumber. Tiap provider
// nyimpen `sources[]` (provenance — sumber mana aja yang nyumbang + kapan).
// Merge policy = gap-fill by priority (lihat scripts/lib/merge.mjs): sumber
// prioritas-tinggi menang, field kosong ditambal sumber lain. BUKAN verifier —
// kita ga nge-judge sumber mana yang "bener".

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
  /** String modality mentah dari sumber, mis. "Text + Vision". null = ga ditulis di sumber. */
  modality: string | null;
  /** Rate limit apa adanya, mis. "200 RPM, 10 RPS". null = ga ditulis. */
  rateLimit: string | null;
}

export interface SourceRef {
  name: string;
  url: string;
  /** ISO timestamp kapan sumber INI di-fetch buat provider ini. */
  syncedAt: string;
}

export interface Provider {
  slug: string;
  name: string;
  /** null = tidak ada sumber yang mengklasifikasikan provider ini. */
  category: ProviderCategory | null;
  /** ISO-2 country code (HQ provider — BUKAN ketersediaan akses). null kalau sumber ga nyediain. */
  country: string | null;
  /** Emoji bendera HQ. null kalau sumber ga nyediain (UI fallback ke logo / globe). */
  flag: string | null;
  /** Registrable domain provider (buat logo). null kalau ga ke-derive. */
  domain: string | null;
  /** URL favicon/logo provider. null kalau ga ada domain. Fallback UI = flag. */
  logo: string | null;
  /** Halaman daftar / ambil API key. */
  url: string | null;
  /** Base URL API (buat dipanggil developer). */
  baseUrl: string | null;
  /** Teks deskripsi apa adanya dari sumber (sering memuat catatan CC/expiry/region).
   *  Absent (di-omit) kalau ga ada sumber yang nyediain — bukan "" kosong. */
  description?: string;

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

  /** Atribusi sumber (WAJIB, >=1) + kapan di-sync. Semua sumber yang nyumbang. */
  sources: SourceRef[];
  /** ISO timestamp run merge (max dari sources[].syncedAt). */
  syncedAt: string;
  /** Tanggal `lastUpdated` yang ditulis sumber. null kalau ga ada. */
  sourceUpdatedAt: string | null;
}

/**
 * Versi ramping buat tabel direktori (client). Sengaja TANPA models[]/baseUrl/
 * sources/url biar payload yang dikirim ke client kecil. `searchText` =
 * name + nama/id model (di-precompute) biar search tetep jalan.
 */
export interface ProviderListItem {
  slug: string;
  name: string;
  logo: string | null;
  flag: string | null;
  category: ProviderCategory | null;
  modelCount: number;
  modalities: Modality[];
  maxContext: string | null;
  freeLimit: string | null;
  description?: string;
  searchText: string;
}
