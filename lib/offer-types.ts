// Data model "modal gratis" — free tier & free credit DI LUAR token LLM
// (hosting, database, storage, email, auth, monitoring, domain, student pack,
// startup credit).
//
// KENAPA ENTITY TERPISAH dari Provider/Model di lib/types.ts:
// skema LLM (context window, modality, rate limit) sama sekali ga muat buat
// "10 GB storage" atau "$10.000 credit". Dipaksa jadi satu = kolom kosong
// bertaburan, persis yang dilarang aturan #1.
//
// KENAPA KURASI MANUAL, BUKAN ADAPTER NIGHTLY:
// riset 2026-07-25 (docs/PRODUCT-ROADMAP.md §3 Fase 5) nemu NOL sumber
// machine-readable di domain ini. free-for-dev (130k bintang) pun cuma nyimpen
// *bahwa* ada free tier + link — angka kuotanya ga ter-encode. Jadi data/offers.json
// di-maintain tangan, kadens mingguan, entri sedikit-tapi-benar.
//
// ATURAN ANTI-HALUSINASI (sama ketatnya kayak lib/types.ts):
//  1. `sources[].url` WAJIB nunjuk halaman RESMI vendor. DILARANG nunjuk situs
//     agregator — riset nemu agregator saling bertentangan (tier Cloudflare versi
//     agregator $5K/$25K/$100K vs halaman resmi $10K/$100K/$350K).
//  2. Angka cuma boleh ditulis kalau halaman resmi nulis angka itu. Ga nulis =
//     baris itu ga usah ada. JANGAN ditaksir, jangan dibulatkan.
//  3. `facets` itu TURUNAN, bukan penilaian. Satu facet cuma boleh nempel kalau
//     ada baris di `limits`/`requirements`/`traps` yang mendukungnya secara
//     eksplisit. Pola ini sama persis kayak `modalities` di Provider yang
//     di-derive dari string modality tiap model.
//  4. `checkedAt` = kapan halaman itu DIBACA. Itu provenance, BUKAN klaim
//     "masih benar sekarang". Sama semantiknya kayak `syncedAt`.
//     Tetap DILARANG pakai kata "Verified"/"Terverifikasi" di UI.

export type OfferCategory =
  | "hosting"
  | "database"
  | "storage"
  | "email"
  | "auth"
  | "monitoring"
  | "devtool"
  | "domain"
  | "student_pack"
  | "startup_credit";

/**
 * Bentuk penawarannya:
 *  - free_tier : gratis berulang/permanen selama dalam batas kuota
 *  - credit    : kredit satu kali dengan nominal
 *  - trial     : gratis berbatas waktu, habis waktu = berhenti/ditagih
 *  - program   : harus melamar & diseleksi (startup program, student pack)
 */
export type OfferKind = "free_tier" | "credit" | "trial" | "program";

/**
 * Facet buat filter. TURUNAN dari teks yang beneran ada di sumber (aturan #3).
 * Sengaja dibikin sebagai daftar tertutup biar ga jadi tempat buang opini.
 */
export type OfferFacet =
  /** Gratis tanpa batas waktu selama dalam kuota — bukan trial. */
  | "permanen"
  /** Halaman resmi menyatakan tidak perlu kartu kredit. */
  | "tanpa_kartu"
  /** Kartu kredit dibutuhkan (walau cuma buat verifikasi). */
  | "kartu_wajib"
  /** Eksplisit terbuka untuk bootstrapped / self-funded. */
  | "tanpa_vc"
  /** Butuh pendanaan institusional ATAU kode referral akselerator/partner. */
  | "butuh_vc"
  /** Butuh badan usaha terdaftar (PT / PT Perorangan / equivalent). */
  | "butuh_badan_usaha"
  /** Khusus pelajar/mahasiswa terverifikasi institusi. */
  | "mahasiswa"
  /** Dilarang dipakai untuk proyek komersial / menghasilkan uang. */
  | "nonkomersial"
  /** Otomatis pause / spin-down kalau nganggur. */
  | "auto_pause"
  /** Berhenti / ditagih otomatis setelah periode tertentu. */
  | "ada_kedaluwarsa";

export interface OfferSource {
  /** Nama halaman sumber, mis. "Vercel — Limits". */
  name: string;
  /** URL halaman RESMI vendor (aturan #1). */
  url: string;
  /** ISO date (YYYY-MM-DD) kapan halaman ini dibaca. Provenance, bukan garansi. */
  checkedAt: string;
}

export interface Offer {
  slug: string;
  /** Nama penawarannya, mis. "Workers Free" — bukan nama vendornya. */
  name: string;
  /** Nama vendor, mis. "Cloudflare". */
  vendor: string;
  /** Domain vendor (buat logo favicon, pola sama kayak Provider.domain). null = ga ke-derive. */
  domain: string | null;
  category: OfferCategory;
  kind: OfferKind;
  /** Halaman buat mulai/daftar/melamar. */
  url: string;
  /** Deskripsi apa adanya, 1–2 kalimat. Bahasa Indonesia. */
  description: string;

  /**
   * Angka batas apa adanya dari halaman resmi, satu baris per batas.
   * Mis. ["100 GB bandwidth/bulan", "1 juta invocation function/bulan"].
   * Array kosong = halaman resmi ga nyebut angka (BUKAN berarti unlimited).
   */
  limits: string[];

  /** Nominal kredit apa adanya, mis. "$10.000". null = bukan program kredit / ga disebut. */
  creditValue: string | null;

  /**
   * Syarat apa adanya dari halaman resmi.
   * Mis. ["Perusahaan berdiri < 10 tahun", "Punya website publik yang live"].
   */
  requirements: string[];

  /**
   * Jebakan / catatan yang bikin orang kena. HANYA yang tertulis di sumber.
   * Mis. ["Dilarang untuk proyek komersial (Fair Use Guidelines)"].
   * Ini justru nilai utama halaman ini, bukan pelengkap.
   */
  traps: string[];

  /** Facet turunan (aturan #3). */
  facets: OfferFacet[];

  /**
   * Bisa diambil indie/bootstrapped Indonesia?
   * Turunan dari `requirements` — "belum_jelas" itu jawaban yang sah dan
   * lebih baik daripada nebak.
   */
  idIndie: "bisa" | "tidak" | "belum_jelas";

  /** Provenance (WAJIB, >= 1). */
  sources: OfferSource[];
}

/** Versi ramping buat tabel/list client (payload kecil, pola sama kayak ProviderListItem). */
export interface OfferListItem {
  slug: string;
  name: string;
  vendor: string;
  domain: string | null;
  category: OfferCategory;
  kind: OfferKind;
  creditValue: string | null;
  facets: OfferFacet[];
  idIndie: Offer["idIndie"];
  description: string;
  /** name + vendor + limits, di-precompute lowercase buat search. */
  searchText: string;
}

export const OFFER_CATEGORY_LABEL: Record<OfferCategory, string> = {
  hosting: "Hosting & Deploy",
  database: "Database",
  storage: "Storage & CDN",
  email: "Email",
  auth: "Auth",
  monitoring: "Monitoring & Analytics",
  devtool: "Tool Developer",
  domain: "Domain",
  student_pack: "Paket Mahasiswa",
  startup_credit: "Kredit Startup",
};

export const OFFER_KIND_LABEL: Record<OfferKind, string> = {
  free_tier: "Gratis berulang",
  credit: "Kredit sekali",
  trial: "Masa coba",
  program: "Program (harus melamar)",
};

export const OFFER_FACET_LABEL: Record<OfferFacet, string> = {
  permanen: "Permanen",
  tanpa_kartu: "Tanpa kartu kredit",
  kartu_wajib: "Kartu kredit wajib",
  tanpa_vc: "Bootstrapped boleh",
  butuh_vc: "Butuh VC / referral",
  butuh_badan_usaha: "Butuh badan usaha",
  mahasiswa: "Khusus mahasiswa",
  nonkomersial: "Dilarang komersial",
  auto_pause: "Auto-pause kalau nganggur",
  ada_kedaluwarsa: "Ada kedaluwarsa",
};
