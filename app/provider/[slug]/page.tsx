import { getAllProviders, getProviderBySlug } from "@/lib/data";
import { getModelClusters } from "@/lib/model-clusters";
import { notFound } from "next/navigation";
import { Link } from "next-view-transitions";
import Navbar from "@/components/Navbar";
import DetailBreadcrumb from "@/components/nav/DetailBreadcrumb";
import ProviderLogo from "@/components/ProviderLogo";
import { CategoryTag, ModalityTags, SourceLine, modalityLabel } from "@/components/directory/Badges";
import ModelsTable from "@/components/directory/ModelsTable";
import ProviderFaq from "@/components/directory/ProviderFaq";
import SetupPanel from "@/components/setup/SetupPanel";
import type { Provider } from "@/lib/types";
import { providerSnippet } from "@/lib/seo";
import { fmtDate } from "@/lib/date";

export async function generateStaticParams() {
  return getAllProviders().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getProviderBySlug(slug);
  if (!p) return {};

  const { title, description } = providerSnippet({
    name: p.name,
    modelCount: p.modelCount,
    maxContext: p.maxContext,
    modalityText: p.modalities.map(modalityLabel).join("/"),
    syncedLabel: p.syncedAt ? fmtDate(p.syncedAt) : null,
  });

  return {
    title,
    description,
    alternates: { canonical: `https://tokengratis.id/provider/${p.slug}` },
    openGraph: {
      title,
      description,
      url: `https://tokengratis.id/provider/${p.slug}`,
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

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-mute">{label}</span>
      <span className="text-sm font-medium text-fog">{children}</span>
    </div>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p: Provider | undefined = getProviderBySlug(slug);
  if (!p) notFound();

  // Model provider ini yang PUNYA halaman /model/[slug]. Diambil dari
  // getModelClusters() — sumber yang SAMA persis dipake generateStaticParams
  // di /model/[slug] (cluster = nama model yang sama di >=2 provider), jadi
  // mustahil nge-link slug yang halamannya ga di-generate. Nama modelnya
  // verbatim punya provider ini, bukan displayName cluster: itu string yang
  // barusan user baca di tabel di atas.
  const crossProvider = getModelClusters().flatMap((c) => {
    const mine = c.entries.find((e) => e.provider.slug === p.slug);
    if (!mine) return [];
    return [
      {
        slug: c.slug,
        name: mine.model.name,
        providerCount: new Set(c.entries.map((e) => e.provider.slug)).size,
      },
    ];
  });

  return (
    <div className="min-h-dvh pb-24">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        <DetailBreadcrumb current={p.name} />

        {/* hero header */}
        <header className="flex flex-col gap-5 border-b border-ink-line pb-8 sm:flex-row sm:items-start">
          <ProviderLogo
            logo={p.logo}
            flag={p.flag}
            name={p.name}
            className="h-16 w-16"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-fog sm:text-4xl">
              {p.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mute">
              <CategoryTag category={p.category} />
              <span>{p.modelCount} model</span>
              {p.maxContext && (
                <>
                  <span aria-hidden>·</span>
                  <span>context maks {p.maxContext}</span>
                </>
              )}
              {p.freeLimit && (
                <span className="inline-flex items-center rounded-full border border-grass-line bg-grass-bg px-2.5 py-0.5 font-medium text-grass">
                  Gratis: {p.freeLimit}
                </span>
              )}
            </div>
            <div className="mt-4">
              <ModalityTags modalities={p.modalities} full />
            </div>
          </div>
        </header>

        {/* 2-col: main + sidebar */}
        <div className="mt-6 grid gap-6 sm:mt-8 sm:gap-8 lg:grid-cols-[1fr_300px]">
          {/* main */}
          <div className="order-2 min-w-0 space-y-6 lg:order-1">
            {/* catatan */}
            {p.description && (
              <section className="rounded-[8px] border border-ink-line bg-ink-soft px-5 py-4">
                <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                  Catatan dari sumber
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-fog">
                  {p.description}
                </p>
              </section>
            )}

            {/* setup dalam 5 menit — snippet siap pakai dari data yang ada
                (baseUrl + models[]). Client component, ga ada base URL/model
                yang dikarang (lihat lib/snippets.ts). */}
            <section>
              <h2 className="font-serif text-xl font-semibold tracking-tight text-fog sm:text-2xl">
                Setup dalam 5 menit
              </h2>
              <div className="mt-3">
                <SetupPanel provider={p} />
              </div>
            </section>

            {/* cara claim — alur umum (pakai field sumber: url + baseUrl). Bukan
                instruksi terverifikasi per-provider; detail pasti di halaman resmi. */}
            {p.url && (
              <section className="rounded-[8px] border border-ink-line bg-ink-soft px-5 py-4">
                <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                  Cara claim API key gratis
                </h2>
                <p className="mt-1 text-[11px] text-mute">
                  Langkah umum — detail pastinya ikutin halaman resmi {p.name}.
                </p>
                <ol className="mt-3 space-y-2 text-sm leading-relaxed text-fog">
                  <li className="flex gap-2.5">
                    <span className="font-mono text-xs text-mute">1.</span>
                    <span>
                      Buka{" "}
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-ink-line underline-offset-2 hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
                      >
                        halaman API key {p.name} ↗
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="font-mono text-xs text-mute">2.</span>
                    <span>Daftar akun baru, atau login kalau udah punya.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="font-mono text-xs text-mute">3.</span>
                    <span>Generate API key di dashboard / settings.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="font-mono text-xs text-mute">4.</span>
                    <span className="min-w-0">
                      Pakai API key
                      {p.baseUrl && (
                        <>
                          {" "}
                          + Base URL{" "}
                          <code className="inline-block max-w-full overflow-x-auto whitespace-nowrap rounded-[3px] border border-ink-line bg-ink px-1.5 py-0.5 align-bottom font-mono text-[12px]">
                            {p.baseUrl}
                          </code>
                        </>
                      )}{" "}
                      di SDK atau HTTP client.
                    </span>
                  </li>
                </ol>
              </section>
            )}

            {/* models */}
            <ModelsTable
              models={p.models}
              more={p.moreModels}
              sourceUrl={p.sources[0]?.url}
            />

            {/* Nutup graf link: sebelum ini 0 halaman /model/[slug] ke-link dari
                mana pun di situs (cuma dari Google), padahal arah baliknya
                model -> provider udah jalan. Sengaja seksi sendiri, BUKAN baris
                tabel di atas: ModelsTable dipake bareng permukaan lain. */}
            {crossProvider.length > 0 && (
              <section className="overflow-hidden rounded-[8px] border border-ink-line bg-ink-soft">
                <div className="border-b border-ink-line px-5 py-3.5">
                  <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                    Model ini di provider lain ({crossProvider.length})
                  </h2>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[11px] leading-relaxed text-mute">
                    Nama model yang sama juga muncul di provider lain menurut sumber
                    masing-masing — versi/kuantisasi bisa beda.
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {crossProvider.map((m) => (
                      <li key={m.slug} className="min-w-0">
                        <Link
                          href={`/model/${m.slug}`}
                          className="inline-flex min-h-[44px] max-w-full items-center gap-1.5 rounded-full border border-ink-line bg-ink px-3 text-xs text-mute transition-colors hover:border-mute hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
                        >
                          <span className="min-w-0 truncate font-medium text-fog">
                            {m.name}
                          </span>
                          <span className="shrink-0">· {m.providerCount} provider</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* FAQ — auto-generated dari field yang ada, matching FAQPage JSON-LD */}
            <ProviderFaq provider={p} />
          </div>

          {/* sidebar */}
          <aside className="order-1 h-fit min-w-0 space-y-4 lg:order-2 lg:sticky lg:top-20">
            <div className="space-y-4 rounded-[8px] border border-ink-line bg-ink-soft p-5">
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-[6px] bg-ember px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ember-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-soft"
                >
                  Dapatkan API key
                  <span aria-hidden>↗</span>
                </a>
              )}

              {p.baseUrl && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-mute">Base URL</p>
                  <code className="block overflow-x-auto whitespace-nowrap rounded-[4px] bg-ink px-3 py-2 font-mono text-[12px] text-fog">
                    {p.baseUrl}
                  </code>
                </div>
              )}

              <div className="space-y-2.5 border-t border-ink-line pt-4">
                {p.freeLimit && (
                  <Fact label="Gratis">
                    <span className="text-grass">{p.freeLimit}</span>
                  </Fact>
                )}
                {p.maxContext && (
                  <Fact label="Context maks">{p.maxContext}</Fact>
                )}
                <Fact label="Jumlah model">{p.modelCount}</Fact>
                {p.domain && (
                  <Fact label="Domain">
                    <a
                      href={`https://${p.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-fog underline decoration-ink-line underline-offset-2 transition-colors hover:decoration-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
                    >
                      {p.domain}
                    </a>
                  </Fact>
                )}
              </div>

              <div className="border-t border-ink-line pt-4">
                <h2 className="font-sans mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                  Sumber data
                </h2>
                <SourceLine sources={p.sources} sourceUpdatedAt={p.sourceUpdatedAt} />
                <p className="mt-2 text-[11px] leading-relaxed text-mute">
                  Kami aggregator — bukan verifier, bukan pemilik datanya. Kalau ada
                  yang ga akurat,{" "}
                  <a
                    href={p.sources[0]?.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-ink-line underline-offset-2 hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
                  >
                    {p.sources.length > 1
                      ? "perbaiki di sumber masing-masing"
                      : "perbaiki di sumbernya"}
                  </a>
                  .
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* SoftwareApplication JSON-LD */}
        {(() => {
          const providerUrl =
            p.url ?? (p.domain ? `https://${p.domain}` : undefined);
          const jsonLd: Record<string, unknown> = {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: p.name,
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Web",
            inLanguage: "id",
            description:
              p.description ?? `Free tier API dari ${p.name} — ${p.modelCount} model.`,
          };
          if (providerUrl) jsonLd.url = providerUrl;
          return (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
              }}
            />
          );
        })()}

        {/* BreadcrumbList JSON-LD — nama crumb-nya SENGAJA sama persis sama
            breadcrumb yang keliatan di halaman (Google minta cocok). */}
        {(() => {
          const jsonLd = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Direktori",
                item: "https://tokengratis.id",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: p.name,
                item: `https://tokengratis.id/provider/${p.slug}`,
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

        {/* CollectionPage + ItemList (model) JSON-LD */}
        {(() => {
          const jsonLd = {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Model gratis ${p.name}`,
            url: `https://tokengratis.id/provider/${p.slug}`,
            inLanguage: "id",
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: p.models.length,
              itemListElement: p.models.map((m, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: m.name,
              })),
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
      </main>
    </div>
  );
}
