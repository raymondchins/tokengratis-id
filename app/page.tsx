import { Link } from "next-view-transitions";
import Navbar from "@/components/Navbar";
import DirectoryClient from "./directory/DirectoryClient";
import { getListItems, getLastUpdated } from "@/lib/data";

export default function Home() {
  const items = getListItems();
  const lastUpdatedIso = getLastUpdated();
  const lastUpdated = lastUpdatedIso ? new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta",
  }).format(new Date(lastUpdatedIso)) : null;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "CollectionPage",
    name: "Direktori API AI gratis", url: "https://tokengratis.id", inLanguage: "id",
    mainEntity: {
      "@type": "ItemList", numberOfItems: items.length,
      itemListElement: items.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `https://tokengratis.id/provider/${p.slug}`, name: p.name })),
    },
  };

  return (
    <div className="min-h-dvh pb-16">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-6xl px-5 sm:px-8">
        <section id="direktori" className="scroll-mt-32 pt-8 sm:pt-12">
          <div className="mb-7 max-w-3xl sm:mb-8">
            <h1 className="text-balance font-serif text-4xl font-medium leading-[1.12] tracking-tight text-fog sm:text-5xl">Cari token AI gratis.<br />Mulai dari kebutuhanmu.</h1>
            <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-mute">Temukan API AI gratis untuk proyekmu. Cari model yang kamu kenal, atau pilih mau dipakai untuk apa.</p>
          </div>
          <DirectoryClient items={items} />
          <p className="mt-5 max-w-3xl text-xs leading-relaxed text-mute">Gratis tetap punya batas pemakaian dan syarat dari masing-masing penyedia.{lastUpdated && <> Data terakhir disinkron <time dateTime={lastUpdatedIso!}>{lastUpdated}</time>.</>} <a href="#sumber" className="underline underline-offset-2 hover:text-fog">Lihat sumber data</a>.</p>
        </section>

        <section id="cara-kerja" className="mt-14 scroll-mt-32 border-t border-ink-line pt-8 sm:mt-20 sm:pt-10">
          <div className="grid gap-7 md:grid-cols-[1fr_1.5fr] md:gap-12">
            <div>
              <h2 className="font-serif text-3xl font-medium tracking-tight">Baru pertama pakai API?</h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-mute">API menghubungkan aplikasi kamu ke AI. Token adalah satuan pemakaian teksnya, bukan saldo yang bisa dipindah antar layanan.</p>
              <Link href="/pilih" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold underline underline-offset-4 hover:text-grass">Bantu pilih model <span aria-hidden="true">→</span></Link>
            </div>
            <ol className="divide-y divide-ink-line">
              <li className="pb-5"><h3 className="font-sans text-base font-semibold">1. Pilih penyedia yang sesuai</h3><p className="mt-1.5 text-sm leading-relaxed text-mute">Cari berdasarkan kebutuhanmu, lalu buka “Cara pakai” untuk melihat model, kuota, dan catatan syaratnya.</p></li>
              <li className="py-5"><h3 className="font-sans text-base font-semibold">2. Buka layanan resminya</h3><p className="mt-1.5 text-sm leading-relaxed text-mute">Ikuti petunjuk penyedia. Jika diminta, daftar akun dan buat API key. Token gratisnya digunakan di layanan tersebut.</p></li>
              <li className="pt-5"><h3 className="font-sans text-base font-semibold">3. Hubungkan ke proyekmu</h3><p className="mt-1.5 text-sm leading-relaxed text-mute">Pakai API key di aplikasi yang mendukung penyedia itu. Contoh kode tersedia di halaman detail jika data setup-nya ada.</p></li>
            </ol>
          </div>
        </section>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-line px-5 py-4 text-sm">
          <p className="text-mute">Sudah jalan, tapi sering kena batas pemakaian?</p>
          <Link href="/fallback" className="inline-flex min-h-11 items-center gap-2 font-semibold hover:underline underline-offset-4">Siapkan API cadangan <span aria-hidden="true">→</span></Link>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </main>
    </div>
  );
}
