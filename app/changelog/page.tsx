import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Perubahan Data — Model & Provider Baru | tokengratis.id",
  description:
    "Riwayat perubahan data tokengratis.id: model & provider baru, model yang hilang — di-generate otomatis tiap malam dari hasil sync. Aggregator transparan, bukan verifier.",
  alternates: { canonical: "https://tokengratis.id/changelog" },
  openGraph: {
    title: "Perubahan Data — Model & Provider Baru | tokengratis.id",
    description:
      "Riwayat perubahan data tokengratis.id: model & provider baru, di-generate otomatis tiap malam dari hasil sync.",
    url: "https://tokengratis.id/changelog",
    siteName: "tokengratis.id",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Perubahan Data — Model & Provider Baru | tokengratis.id",
    description:
      "Riwayat perubahan data tokengratis.id: model & provider baru, di-generate otomatis tiap malam dari hasil sync.",
    creator: "@raymondchins",
  },
};

interface ChangelogProviderRef {
  slug: string;
  name: string;
}

interface ChangelogModelDiff {
  provider: string;
  added: string[];
  removed: string[];
}

interface ChangelogEntry {
  date: string; // YYYY-MM-DD
  providersAdded: ChangelogProviderRef[];
  providersRemoved: ChangelogProviderRef[];
  models: ChangelogModelDiff[];
}

/** Baca data/changelog.json langsung (build-time, read-only) — reader lokal
 * biar file ini ga gantung ke lib/data.ts (dipegang agent lain). */
function getChangelog(): ChangelogEntry[] {
  try {
    const raw = readFileSync(join(process.cwd(), "data", "changelog.json"), "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...parsed].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  } catch {
    return [];
  }
}

function formatDate(date: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(new Date(`${date}T00:00:00Z`));
  } catch {
    return date;
  }
}

function monthYearNow(): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

export default function ChangelogPage() {
  const entries = getChangelog();

  return (
    <div className="min-h-dvh pb-24">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-3xl px-4 pt-16 sm:px-6 sm:pt-24">
        {/* ── Hero ── */}
        <section className="text-center">
          <h1 className="font-serif text-4xl font-medium leading-[1.04] tracking-tight text-fog sm:text-5xl">
            Perubahan data
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-mute sm:text-lg">
            Model & provider baru,{" "}
            <span className="font-medium text-fog">di-generate otomatis tiap malam</span>{" "}
            dari hasil sync. Bukan klaim — cuma fakta diff data, apa adanya.
          </p>
        </section>

        {/* ── Entries ── */}
        <section className="mt-12 sm:mt-16">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[8px] border border-ink-line bg-ink-soft px-8 py-20 text-center">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-grass-solid"
              />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-mute">
                Belum ada perubahan tercatat — tracking mulai {monthYearNow()}. Data
                di-sync tiap malam; perubahan muncul di sini otomatis.
              </p>
            </div>
          ) : (
            <ol className="space-y-10">
              {entries.map((entry) => {
                const lines = [
                  ...entry.providersAdded.map((p) => ({
                    key: `add-provider-${p.slug}`,
                    className: "text-grass",
                    node: (
                      <>
                        Provider baru: <span className="font-medium text-fog">{p.name}</span>
                      </>
                    ),
                  })),
                  ...entry.providersRemoved.map((p) => ({
                    key: `rm-provider-${p.slug}`,
                    className: "text-mute",
                    node: (
                      <>
                        Provider dihapus: <span className="font-medium text-fog">{p.name}</span>
                      </>
                    ),
                  })),
                  ...entry.models.flatMap((m) => [
                    ...m.added.map((name) => ({
                      key: `add-${m.provider}-${name}`,
                      className: "text-grass",
                      node: (
                        <>
                          + {name} di <span className="font-medium text-fog">{m.provider}</span>
                        </>
                      ),
                    })),
                    ...m.removed.map((name) => ({
                      key: `rm-${m.provider}-${name}`,
                      className: "text-mute",
                      node: (
                        <>
                          − {name} dari <span className="font-medium text-fog">{m.provider}</span>
                        </>
                      ),
                    })),
                  ]),
                ];

                return (
                  <li
                    key={entry.date}
                    className="border-b border-ink-line pb-8 last:border-b-0 last:pb-0"
                  >
                    <h2 className="font-serif text-xl font-medium text-fog sm:text-2xl">
                      {formatDate(entry.date)}
                    </h2>
                    <ul className="mt-4 space-y-1.5 text-sm leading-relaxed">
                      {lines.map((line) => (
                        <li key={line.key} className={line.className}>
                          {line.node}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}
