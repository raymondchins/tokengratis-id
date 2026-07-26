import { notFound } from "next/navigation";
import { Link } from "next-view-transitions";
import Navbar from "@/components/Navbar";
import ProviderLogo from "@/components/ProviderLogo";
import { getAllOffers, getOfferBySlug } from "@/lib/offers-data";
import {
  OFFER_CATEGORY_LABEL,
  OFFER_FACET_LABEL,
  OFFER_KIND_LABEL,
  type Offer,
} from "@/lib/offer-types";

export async function generateStaticParams() {
  return getAllOffers().map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const o = getOfferBySlug(slug);
  if (!o) return {};

  const title = `${o.name} (${o.vendor}) — Modal Gratis | tokengratis.id`;

  const kindLabel = OFFER_KIND_LABEL[o.kind].toLowerCase();
  const categoryLabel = OFFER_CATEGORY_LABEL[o.category];
  const creditClause = o.creditValue ? ` Kredit ${o.creditValue}.` : "";
  const description = `${o.name} dari ${o.vendor}: ${kindLabel}, kategori ${categoryLabel}.${creditClause} Dikurasi manual dari halaman resmi vendor — bukan sync otomatis, bukan klaim "terverifikasi".`;

  return {
    title,
    description,
    alternates: { canonical: `https://tokengratis.id/modal-gratis/${o.slug}` },
    openGraph: {
      title,
      description,
      url: `https://tokengratis.id/modal-gratis/${o.slug}`,
      siteName: "tokengratis.id",
      locale: "id_ID",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

function fmtDate(iso: string): string {
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

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-mute">{label}</span>
      <span className="text-sm font-medium text-fog">{children}</span>
    </div>
  );
}

const ID_INDIE_LABEL: Record<Offer["idIndie"], string> = {
  bisa: "Bisa buat indie Indonesia",
  tidak: "Butuh VC atau referral",
  belum_jelas: "Belum jelas",
};

function IdIndieBadge({ idIndie }: { idIndie: Offer["idIndie"] }) {
  const cls =
    idIndie === "bisa"
      ? "border-grass-line bg-grass-bg text-grass"
      : idIndie === "tidak"
        ? "border-ink-line bg-ink text-fog"
        : "border-ink-line bg-ink-soft text-mute italic";
  const icon = idIndie === "bisa" ? "✓" : idIndie === "tidak" ? "→" : "?";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-[12.5px] font-medium ${cls}`}
    >
      <span aria-hidden="true">{icon}</span>
      {ID_INDIE_LABEL[idIndie]}
    </span>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const o: Offer | undefined = getOfferBySlug(slug);
  if (!o) notFound();

  const logo = o.domain
    ? `https://www.google.com/s2/favicons?sz=128&domain=${o.domain}`
    : null;

  return (
    <div className="min-h-dvh pb-24">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        {/* back */}
        <Link
          href="/modal-gratis"
          className="group -mx-2 mb-8 inline-flex items-center gap-1.5 px-2 py-3 text-sm text-mute transition-colors hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
        >
          <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
            ←
          </span>
          Kembali ke modal gratis
        </Link>

        {/* hero header */}
        <header className="flex flex-col gap-5 border-b border-ink-line pb-8 sm:flex-row sm:items-start">
          <ProviderLogo logo={logo} flag={null} name={o.vendor} className="h-16 w-16" priority />
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-fog sm:text-4xl">
              {o.name}
            </h1>
            <p className="mt-1 text-sm text-mute">{o.vendor}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mute">
              <span className="inline-flex shrink-0 items-center rounded-[4px] border border-ink-line bg-ink px-2 py-0.5 font-medium text-mute">
                {OFFER_CATEGORY_LABEL[o.category]}
              </span>
              <span
                className={
                  o.kind === "free_tier"
                    ? "inline-flex shrink-0 items-center rounded-[4px] border border-grass-line bg-grass-bg px-2 py-0.5 font-semibold text-grass"
                    : "inline-flex shrink-0 items-center rounded-[4px] border border-ink-line bg-ink-soft px-2 py-0.5 font-medium text-mute"
                }
              >
                {OFFER_KIND_LABEL[o.kind]}
              </span>
              {o.creditValue && (
                <span className="inline-flex items-center rounded-full border border-grape-line bg-grape-bg px-2.5 py-0.5 font-medium text-grape">
                  Kredit {o.creditValue}
                </span>
              )}
            </div>

            <div className="mt-4">
              <IdIndieBadge idIndie={o.idIndie} />
            </div>
          </div>
        </header>

        {/* 2-col: main + sidebar */}
        <div className="mt-6 grid gap-6 sm:mt-8 sm:gap-8 lg:grid-cols-[1fr_300px]">
          {/* main */}
          <div className="order-2 min-w-0 space-y-6 lg:order-1">
            {/* deskripsi apa adanya */}
            {o.description && (
              <section className="rounded-[8px] border border-ink-line bg-ink-soft px-5 py-4">
                <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                  Apa ini
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-fog">{o.description}</p>
              </section>
            )}

            {/* limits — cuma dirender kalau ada, angka apa adanya */}
            {o.limits.length > 0 && (
              <section className="rounded-[8px] border border-ink-line bg-ink-soft px-5 py-4">
                <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                  Batas & kuota
                </h2>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-fog">
                  {o.limits.map((l) => (
                    <li key={l} className="flex gap-2.5">
                      <span aria-hidden="true" className="shrink-0 text-mute">
                        ·
                      </span>
                      <span className="min-w-0">{l}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* requirements — cuma dirender kalau ada */}
            {o.requirements.length > 0 && (
              <section className="rounded-[8px] border border-ink-line bg-ink-soft px-5 py-4">
                <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                  Syarat
                </h2>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-fog">
                  {o.requirements.map((r) => (
                    <li key={r} className="flex gap-2.5">
                      <span aria-hidden="true" className="shrink-0 text-mute">
                        ·
                      </span>
                      <span className="min-w-0">{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* traps — nilai utama halaman ini, treatment visually distinct */}
            {o.traps.length > 0 && (
              <section className="rounded-[8px] border-l-[3px] border-ember bg-ink-soft px-5 py-4">
                <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                  <span aria-hidden="true">⚠</span> Jebakan yang perlu diwaspadai
                </h2>
                <ul className="mt-3 space-y-2.5 text-sm font-medium leading-relaxed text-fog">
                  {o.traps.map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <span aria-hidden="true" className="shrink-0">
                        ⚠
                      </span>
                      <span className="min-w-0">{t}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* facets — turunan, cuma dirender kalau ada */}
            {o.facets.length > 0 && (
              <section className="rounded-[8px] border border-ink-line bg-ink-soft px-5 py-4">
                <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                  Ciri-ciri
                </h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {o.facets.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center rounded-[4px] border border-ink-line bg-ink px-2.5 py-1 text-[12.5px] font-medium text-mute"
                    >
                      {OFFER_FACET_LABEL[f]}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* sidebar */}
          <aside className="order-1 h-fit min-w-0 space-y-4 lg:order-2 lg:sticky lg:top-20">
            <div className="space-y-4 rounded-[8px] border border-ink-line bg-ink-soft p-5">
              <a
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-[6px] bg-ember px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ember-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
              >
                Buka halaman resmi
                <span aria-hidden>↗</span>
              </a>

              <div className="space-y-2.5 border-t border-ink-line pt-4">
                <Fact label="Kategori">{OFFER_CATEGORY_LABEL[o.category]}</Fact>
                <Fact label="Bentuk">{OFFER_KIND_LABEL[o.kind]}</Fact>
                {o.creditValue && (
                  <Fact label="Kredit">
                    <span className="text-grape">{o.creditValue}</span>
                  </Fact>
                )}
                {o.domain && (
                  <Fact label="Domain">
                    <a
                      href={`https://${o.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-fog underline decoration-ink-line underline-offset-2 transition-colors hover:decoration-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
                    >
                      {o.domain}
                    </a>
                  </Fact>
                )}
              </div>

              <div className="border-t border-ink-line pt-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                  Sumber & kapan dicek
                </p>
                <ul className="space-y-1.5">
                  {o.sources.map((s) => (
                    <li key={s.url} className="text-[11px] leading-relaxed text-mute">
                      Dicek {fmtDate(s.checkedAt)} dari{" "}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-fog underline decoration-ink-line underline-offset-2 transition-colors hover:decoration-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
                      >
                        {s.name}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] leading-relaxed text-mute">
                  Kurasi manual — bukan klaim data ini masih akurat sekarang.
                  Vendor bisa ubah syarat & kuota kapan aja; selalu cek ulang{" "}
                  <a
                    href={o.sources[0]?.url ?? o.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-ink-line underline-offset-2 hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
                  >
                    halaman resminya
                  </a>{" "}
                  sebelum daftar.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* Offer JSON-LD */}
        {(() => {
          const jsonLd: Record<string, unknown> = {
            "@context": "https://schema.org",
            "@type": "Offer",
            name: `${o.name} — ${o.vendor}`,
            url: `https://tokengratis.id/modal-gratis/${o.slug}`,
            inLanguage: "id",
            category: OFFER_CATEGORY_LABEL[o.category],
            description:
              o.description || `${OFFER_KIND_LABEL[o.kind]} dari ${o.vendor}.`,
            seller: {
              "@type": "Organization",
              name: o.vendor,
              ...(o.domain ? { url: `https://${o.domain}` } : {}),
            },
          };
          return (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
              }}
            />
          );
        })()}

        {/* BreadcrumbList JSON-LD */}
        {(() => {
          const jsonLd = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Beranda",
                item: "https://tokengratis.id",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Modal Gratis",
                item: "https://tokengratis.id/modal-gratis",
              },
              {
                "@type": "ListItem",
                position: 3,
                name: o.name,
                item: `https://tokengratis.id/modal-gratis/${o.slug}`,
              },
            ],
          };
          return (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
              }}
            />
          );
        })()}
      </main>
    </div>
  );
}
