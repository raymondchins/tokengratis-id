// Data model untuk satu offer/listing (PRD §6).
// ATURAN ANTI-HALUSINASI (PRD §7): field yang ga eksplisit di sumber = "unknown".
// Jangan pernah infer/nebak. Tiap entry WAJIB punya minimal satu `sources`.

export type Category = "llm" | "embeddings" | "image" | "audio" | "agent";

export type OfferType = "free_tier" | "free_credits" | "trial";

/** Tri-state jujur: kalau ragu, "unknown" — bukan Yes/No palsu. */
export type Tristate = "yes" | "no" | "unknown";

/** Status akses dari Indonesia (PRD §9). Default WAJIB "unconfirmed". */
export type IndonesiaAccess = "accessible" | "conditional" | "unconfirmed";

/** Atribusi sumber — tiap field hasil extract simpan kutipan + URL (PRD §7.2). */
export interface SourceRef {
  /** Nama sumber, mis. "cheahjs/free-llm-api-resources" */
  name: string;
  url: string;
  /** Potongan teks asal dari sumber (buat audit). Opsional. */
  quote?: string;
}

export interface Offer {
  slug: string;
  provider: string;
  /** Path/URL logo. null kalau belum ada. */
  logo: string | null;
  category: Category;
  offerType: OfferType;

  /** Jumlah credit/kuota gratis kalau tertulis. null = unknown. */
  freeQuota: string | null;
  /** Rate limit kalau tertulis. null = unknown. */
  rateLimit: string | null;

  requiresCreditCard: Tristate;
  requiresPhoneVerification: Tristate;
  apiAvailable: Tristate;

  indonesiaAccess: IndonesiaAccess;

  /** Aturan kadaluarsa kalau ada. null = unknown. */
  expiry: string | null;

  signupUrl: string | null;
  docsUrl: string | null;

  /** WAJIB ≥1 (PRD §7.4). */
  sources: SourceRef[];
  /** ISO date string, tanggal terakhir di-sync dari sumber. */
  syncedAt: string;
}
