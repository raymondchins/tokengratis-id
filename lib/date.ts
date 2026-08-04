/**
 * Format tanggal ISO ke gaya Indonesia pendek ("27 Jul 2026").
 *
 * Diekstrak 2026-08-03 dari 3 salinan byte-identik (Badges.tsx, ProviderFaq.tsx,
 * OfferCard.tsx) waktu `generateMetadata` di halaman provider butuh yang keempat.
 * Input yang bukan tanggal dikembalikan apa adanya — jangan pernah nampilin
 * "Invalid Date" ke user, mending string mentahnya (aggregator, bukan verifier:
 * yang ditampilin harus persis yang ada di sumber).
 */
export function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
