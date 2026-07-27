import { Link } from "next-view-transitions";
import Navbar from "@/components/Navbar";
import DirectoryClient from "./directory/DirectoryClient";
import { getListItems, getLastUpdated } from "@/lib/data";

// ring-INSET, bukan ring biasa: tiga baris ini full-bleed di dalam container
// `overflow-hidden`, jadi ring di luar border bakal ke-clip separo.
const TASK_ROW =
  "group flex min-h-[44px] min-w-0 flex-col justify-center bg-ink-soft px-5 py-4 transition-colors hover:bg-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fog/70";

const principles = [
  {
    title: "Aggregator, bukan verifier",
    body: "Data dikumpulin dari sumber komunitas tepercaya, ditampilin apa adanya — lengkap sama atribusi & link sumbernya.",
  },
  {
    title: "Synced, bukan “verified”",
    body: "Tiap provider nampilin terakhir di-sync kapan & dari sumber mana — trust dari transparansi, bukan dari klaim.",
  },
  {
    title: "Apa adanya, ga nebak",
    body: "Cuma nampilin yang ada di sumber — model, context, rate limit, modality. Ga ada field tebakan atau kolom kosong.",
  },
];

export default function Home() {
  const items = getListItems();
  const count = items.length;
  const totalModels = items.reduce((n, p) => n + p.modelCount, 0);
  const lastUpdatedIso = getLastUpdated();
  const lastUpdated = lastUpdatedIso
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        // Audience Indonesia + cron sync jam 02:00 WIB = ~19:00 UTC hari
        // sebelumnya. Tanpa timeZone, build/runtime UTC di Vercel bikin label
        // "Last update" mundur 1 hari. Paksa WIB biar tanggalnya jujur.
        timeZone: "Asia/Jakarta",
      }).format(new Date(lastUpdatedIso))
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Direktori API AI gratis",
    url: "https://tokengratis.id",
    inLanguage: "id",
    numberOfItems: items.length,
    itemListElement: items.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://tokengratis.id/provider/${p.slug}`,
      name: p.name,
    })),
  };

  return (
    <div className="min-h-dvh pb-12">
      <Navbar />

      <main id="main-content" className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-3xl pt-16 text-center sm:pt-24">
          <h1 className="font-serif text-4xl font-medium leading-[1.04] tracking-tight text-fog sm:text-5xl md:text-6xl">
            API AI yang bisa
            <br />
            dipake gratis
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-mute sm:text-lg">
            Free tier &amp; free credits API LLM — di-aggregate otomatis dari
            sumber komunitas. Tiap provider nampilin{" "}
            <span className="font-medium text-fog">
              model, context window, rate limit &amp; modality
            </span>{" "}
            apa adanya dari sumber.
          </p>

          <span className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-grass-line bg-grass-bg px-3 py-1 text-xs font-medium text-grass">
            <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-grass-solid" /> {count} provider · {totalModels} model gratis
          </span>

          {/* ── Tiga jalan masuk ──
              Ditaruh di HERO, bukan cuma di navbar/footer. Diukur di HP:
              dokumen 7.272px (9 layar), semua link header ke /pilih,
              /modal-gratis, /opensource `visible: false` (ketutup hamburger),
              /fallback nol di header, dan link pertama yang KEBACA ke tool
              mana pun nangkring di y≈7.019px alias 8,6 layar ke bawah. Efeknya
              situs ini kebaca sebagai satu tabel doang — /fallback, yang justru
              jawab keluhan inti audiens ("kepentok token"), ga pernah ketemu.

              BUKAN grid 3 kartu kembar (ikon+judul+teks diulang 3x = persis
              anti-pattern DESIGN.md). Asimetrinya bawa arti: baris 1 = aksi
              default (tabelnya emang isi halaman ini) — full-width, judul dulu
              baru keterangan, dan satu-satunya yang bawa ANGKA. Baris 2 & 3 =
              kondisi "kalau lagi X", cuma relevan buat sebagian orang — setengah
              lebar, dan hierarkinya DIBALIK: pertanyaan mute dulu, aksi fog
              belakangan.

              Nol elemen hitam di sini. Dua dari tiga tujuan cuma scroll/pindah
              ringan, dan hitam di hero "/" udah ditolak sekali waktu CTA navbar
              di-demote (lihat Navbar.tsx) — bobotnya dibawa border + swap
              permukaan, bukan warna aksi. */}
          <div className="mt-10 grid gap-px overflow-hidden rounded-[8px] border border-ink-line bg-ink-line text-left sm:mt-12 sm:grid-cols-2">
            <a href="#direktori" className={`${TASK_ROW} sm:col-span-2`}>
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-serif text-base font-semibold tracking-tight text-fog">
                  Cari sendiri
                </span>
                {/* Bukan ngulang angka di pill hijau persis di atasnya —
                    yang dibawa di sini justru bedanya baris 1 dari dua
                    baris lain: ini lompat di halaman yang sama, bukan
                    pindah halaman. */}
                <span className="text-xs text-mute">
                  <span aria-hidden="true">↓</span> langsung di bawah
                </span>
              </span>
              <span className="mt-1 text-sm leading-relaxed text-mute">
                Tabel lengkapnya: model, context window, rate limit, modality.
                Filter sendiri, semua apa adanya dari sumber.
              </span>
            </a>

            <Link href="/pilih" className={TASK_ROW}>
              <span className="text-sm leading-relaxed text-mute">
                Bingung mau pakai yang mana?
              </span>
              <span className="mt-1 text-sm font-semibold text-fog">
                Biar gw pilihin{" "}
                <span aria-hidden="true" className="text-mute">
                  →
                </span>
              </span>
            </Link>

            <Link href="/fallback" className={TASK_ROW}>
              <span className="text-sm leading-relaxed text-mute">
                Kepentok limit tiap beberapa prompt?
              </span>
              <span className="mt-1 text-sm font-semibold text-fog">
                Bikin rantai fallback{" "}
                <span aria-hidden="true" className="text-mute">
                  →
                </span>
              </span>
            </Link>
          </div>
        </section>

        {/* ── Directory table ── */}
        {/* scroll-mt-24 (96px), bukan 20 (80px): navbar sticky berhenti di 70px,
            80px cuma nyisain 10px — ganti tinggi navbar dikit langsung bikin
            anchor mendarat ketutupan. 96px nyisain ruang napas. */}
        <section id="direktori" className="mt-12 scroll-mt-24 sm:mt-16">
          <h2 className="sr-only">Direktori provider</h2>
          {lastUpdated && (
            <p className="mb-3 text-balance text-right text-xs text-mute">
              Last update {lastUpdated}. Udah stale? DM{" "}
              <a
                href="https://instagram.com/raymondchins"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-fog underline decoration-ink-line underline-offset-2 hover:decoration-mute"
              >
                @raymondchins
              </a>{" "}
              suruh gw update.
            </p>
          )}
          <DirectoryClient items={items} />
        </section>

        {/* ── How it works ── */}
        <section id="cara-kerja" className="mt-16 scroll-mt-24 sm:mt-24">
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-fog">
            Cara kerja
          </h2>
          <div className="mt-6 grid gap-px overflow-hidden rounded-[8px] border border-ink-line bg-ink-line sm:grid-cols-3">
            {principles.map((p) => (
              <div key={p.title} className="bg-ink-soft p-6">
                <h3 className="font-serif text-base font-semibold tracking-tight text-fog">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-mute">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Kenapa ── */}
        <section className="mt-16 text-center sm:mt-24">
          <p className="mx-auto max-w-2xl text-balance font-serif text-2xl leading-snug tracking-tight text-fog sm:text-3xl">
            Kenapa gw bikin ini? Karena ✨gratis✨ itu indah, dan gw tau banyak
            dev yang baru belajar suka kepentok token. This is for you guys,
            lets build!
          </p>
          <p className="mx-auto mt-5 max-w-xl text-balance font-serif text-xl leading-snug tracking-tight text-mute sm:text-2xl">
            Punya project AI / suka ngulik AI? Daftar di{" "}
            <a
              href="https://genesis.ceo"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-2 underline-offset-4 transition-colors hover:text-grass"
            >
              genesis.ceo
            </a>{" "}
            :)
          </p>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      </main>
    </div>
  );
}
