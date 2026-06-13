import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import OpensourceClient from "./OpensourceClient";
import {
  getProjects,
  getOpenSourceSources,
  getOpenSourceSyncedAt,
  getLanguages,
} from "@/lib/opensource-data";

export const metadata: Metadata = {
  title: "Proyek Open Source Indonesia — tokengratis.id",
  description:
    "Direktori proyek open-source buatan developer Indonesia, dikurasi komunitas — selalu fresh, langsung dari GitHub. Aggregator transparan, bukan verifier.",
  alternates: { canonical: "https://tokengratis.id/opensource" },
  openGraph: {
    title: "Proyek Open Source Indonesia — tokengratis.id",
    description:
      "Direktori proyek open-source buatan developer Indonesia, dikurasi komunitas.",
    url: "https://tokengratis.id/opensource",
    siteName: "tokengratis.id",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Proyek Open Source Indonesia — tokengratis.id",
    description:
      "Direktori proyek open-source buatan developer Indonesia, dikurasi komunitas.",
    creator: "@raymondchins",
  },
};

export default function OpenSourcePage() {
  const projects = getProjects();
  const sources = getOpenSourceSources();
  const syncedAt = getOpenSourceSyncedAt();
  const languages = getLanguages();
  const count = projects.length;

  const syncedLabel = (() => {
    try {
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(new Date(syncedAt));
    } catch {
      return syncedAt;
    }
  })();

  return (
    <div className="min-h-dvh pb-12">
      <Navbar />

      <main id="main-content" className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-3xl pt-16 text-center sm:pt-24">
          <h1 className="font-serif text-4xl font-medium leading-[1.04] tracking-tight text-fog sm:text-5xl md:text-6xl">
            Proyek open source
            <br />
            Indonesia
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-mute sm:text-lg">
            Direktori proyek open-source buatan developer Indonesia, dikurasi
            komunitas —{" "}
            <span className="font-medium text-fog">
              selalu fresh, langsung dari GitHub.
            </span>
          </p>

          <span className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-grass-line bg-grass-bg px-3 py-1 text-xs font-medium text-grass">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full bg-grass-solid"
            />{" "}
            {count} proyek · disinkron {syncedLabel}
          </span>
        </section>

        {/* ── Listing ── */}
        <section id="direktori" className="mt-12 scroll-mt-20 sm:mt-16">
          <h2 className="sr-only">Direktori proyek open source</h2>
          {/* Sumber di atas search bar (mirror home: kecil, kanan, mute) */}
          <p className="mb-3 text-balance text-right text-[11px] leading-relaxed text-mute">
            Sumber:{" "}
            {sources.map((s, i) => (
              <span key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-fog underline decoration-ink-line underline-offset-2 transition-colors hover:decoration-mute"
                >
                  {s.name}
                </a>
                {i < sources.length - 1 && <span> · </span>}
              </span>
            ))}{" "}
            · disinkron {syncedLabel}
          </p>
          <OpensourceClient projects={projects} languages={languages} />
        </section>
      </main>
    </div>
  );
}
