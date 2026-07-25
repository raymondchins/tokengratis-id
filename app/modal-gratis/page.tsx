import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import ModalGratisClient from "./ModalGratisClient";
import {
  getAllOffers,
  getOfferCategoryCounts,
  getOffersLastCheckedAt,
} from "@/lib/offers-data";

export const metadata: Metadata = {
  title: "Modal Gratis buat Developer Indonesia — tokengratis.id",
  description:
    "Free tier hosting, database, storage, email, auth, monitoring, domain, paket mahasiswa, sampai kredit startup — dikurasi manual dari halaman resmi vendor, lengkap dengan jebakan yang perlu diwaspadai.",
  alternates: { canonical: "https://tokengratis.id/modal-gratis" },
  openGraph: {
    title: "Modal Gratis buat Developer Indonesia — tokengratis.id",
    description:
      "Free tier hosting, database, storage, email, auth, monitoring, domain, sampai kredit startup — dikurasi manual dari halaman resmi vendor.",
    url: "https://tokengratis.id/modal-gratis",
    siteName: "tokengratis.id",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Modal Gratis buat Developer Indonesia — tokengratis.id",
    description:
      "Free tier hosting, database, storage, email, auth, monitoring, domain, sampai kredit startup — dikurasi manual dari halaman resmi vendor.",
    creator: "@raymondchins",
  },
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function ModalGratisPage() {
  const offers = getAllOffers();
  const categoryCounts = getOfferCategoryCounts();
  const lastCheckedAt = getOffersLastCheckedAt();
  const categoryCount = Object.keys(categoryCounts).length;

  return (
    <div className="min-h-dvh pb-12">
      <Navbar />

      <main id="main-content" className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-3xl pt-16 text-center sm:pt-24">
          <h1 className="font-serif text-4xl font-medium leading-[1.04] tracking-tight text-fog sm:text-5xl md:text-6xl">
            Modal gratis buat ngoding,
            <br />
            bukan cuma token
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-mute sm:text-lg">
            Hosting, database, storage, email, auth, monitoring, domain, paket
            mahasiswa, sampai kredit startup —{" "}
            <span className="font-medium text-fog">
              semua yang dibutuhin buat ship produk, gratis atau murah gila.
            </span>
          </p>

          {offers.length > 0 && (
            <span className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-grass-line bg-grass-bg px-3 py-1 text-xs font-medium text-grass">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full bg-grass-solid"
              />{" "}
              {offers.length} penawaran · {categoryCount} kategori
              {lastCheckedAt && <> · dicek terakhir {formatDate(lastCheckedAt)}</>}
            </span>
          )}
        </section>

        {/* ── Honesty note — beda trust model dari direktori token LLM ── */}
        <section className="mx-auto mt-8 max-w-3xl sm:mt-10">
          <div className="rounded-[8px] border-l-[3px] border-ember bg-ink-soft px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mute">
              Beda cara kerja sama direktori token
            </p>
            <p className="mt-2 text-sm leading-relaxed text-fog">
              Halaman ini <span className="font-medium">dikurasi manual</span>,
              bukan di-sync otomatis tiap malam kayak direktori token LLM. Tiap
              penawaran nunjukin kapan halaman resminya terakhir{" "}
              <span className="font-medium">dicek</span> — itu bukti kapan kami
              baca, bukan jaminan syarat & kuotanya masih sama sekarang. Vendor
              sering ubah kuota tanpa woro-woro; selalu cek ulang link resmi
              sebelum daftar.
            </p>
          </div>
        </section>

        {/* ── Listing ── */}
        <section id="modal-gratis-direktori" className="mt-10 scroll-mt-20 sm:mt-14">
          <h2 className="sr-only">Direktori modal gratis</h2>
          <ModalGratisClient offers={offers} />
        </section>
      </main>
    </div>
  );
}
