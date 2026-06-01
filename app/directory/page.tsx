import Link from "next/link";
import { getAllOffers } from "@/lib/data";
import DirectoryClient from "./DirectoryClient";

export const metadata = {
  title: "Direktori — tokengratis.id",
  description:
    "List semua AI free tier & free credits yang bisa diakses dari Indonesia. Di-aggregate dari sumber komunitas, bukan klaim sendiri.",
};

export default function DirectoryPage() {
  const offers = getAllOffers();

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-16 sm:py-24">
      {/* Nav */}
      <nav className="flex items-center gap-3 text-sm">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-mute transition-colors hover:text-fog"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8.5 2.5L4 7l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Kembali
        </Link>
        <span className="text-ink-line">/</span>
        <span className="text-fog">Direktori</span>
      </nav>

      {/* Header */}
      <header className="mt-12 sm:mt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mute">
          Direktori AI gratis &middot; Indonesia-first
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-fog sm:text-5xl">
          Semua offer di satu tempat.{" "}
          <span className="text-ember">Di-filter buat Indonesia.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-mute sm:text-lg">
          Free tier &amp; free credits dari berbagai provider AI — di-aggregate
          otomatis dari sumber komunitas yang udah dipercaya.
        </p>
      </header>

      {/* Transparency note */}
      <aside className="mt-8 rounded-xl border border-ink-line bg-ink-soft px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ember">
          Soal data ini
        </p>
        <p className="mt-2 text-sm leading-relaxed text-mute">
          Data di-aggregate dari sumber komunitas (GitHub, aicredits.dev, dll).
          Tiap entry punya link sumber + tanggal sync yang bisa dicek langsung.
          Kalau ada info yang belum jelas,{" "}
          <span className="text-fog">kita bilang &ldquo;belum dikonfirmasi&rdquo;</span>{" "}
          &mdash; bukan nebak. Situs ini{" "}
          <span className="text-fog">aggregator</span>, bukan verifier &mdash;
          trust dateng dari transparansi, bukan dari klaim.
        </p>
      </aside>

      {/* Count */}
      <div className="mt-6 flex items-center gap-2 text-sm text-mute">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-ember-soft" />
        <span>
          <span className="font-medium text-fog">{offers.length}</span> offer
          terdaftar
        </span>
      </div>

      {/* Client interactive section */}
      <div className="mt-8 flex-1">
        <DirectoryClient offers={offers} />
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-ink-line pt-8 text-sm text-mute">
        <p>
          Sumber: cheahjs/free-llm-api-resources, amardeeplakshkar/awesome-free-llm-apis,
          mnfst/awesome-free-llm-apis, aicredits.dev. Di-sync otomatis tiap malam.
        </p>
        <p className="mt-2 text-xs text-ink-line">
          <span className="text-mute">tokengratis.id</span> &middot; ga dimonetisasi.
        </p>
      </footer>
    </main>
  );
}
