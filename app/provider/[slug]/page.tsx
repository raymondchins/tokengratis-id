import { getAllProviders, getProviderBySlug } from "@/lib/data";
import { notFound } from "next/navigation";
import { Link } from "next-view-transitions";
import Navbar from "@/components/Navbar";
import ProviderLogo from "@/components/ProviderLogo";
import { CategoryTag, ModalityTags, SourceLine } from "@/components/directory/Badges";
import ModelsTable from "@/components/directory/ModelsTable";
import type { Provider } from "@/lib/types";

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
  const contextClause = p.maxContext ? `, sampai ${p.maxContext} context` : "";
  const description = `Free tier / free credits API dari ${p.name}. ${p.modelCount} model${contextClause}. Aggregator, bukan verifier.`;
  return {
    title: `${p.name} — tokengratis.id`,
    description,
    alternates: { canonical: `https://tokengratis.id/provider/${p.slug}` },
    openGraph: {
      title: `${p.name} — tokengratis.id`,
      description,
      url: `https://tokengratis.id/provider/${p.slug}`,
      siteName: "tokengratis.id",
      locale: "id_ID",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${p.name} — tokengratis.id`,
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

  return (
    <div className="min-h-dvh pb-24">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        {/* back */}
        <Link
          href="/#direktori"
          className="group mb-8 inline-flex items-center gap-1.5 text-sm text-mute transition-colors hover:text-fog"
        >
          <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
            ←
          </span>
          Kembali ke direktori
        </Link>

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
              <span aria-hidden>·</span>
              <span>context maks {p.maxContext ?? "—"}</span>
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
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                  Catatan dari sumber
                </p>
                <p className="mt-2 text-sm leading-relaxed text-fog">
                  {p.description}
                </p>
              </section>
            )}

            {/* cara claim — alur umum (pakai field sumber: url + baseUrl). Bukan
                instruksi terverifikasi per-provider; detail pasti di halaman resmi. */}
            {p.url && (
              <section className="rounded-[8px] border border-ink-line bg-ink-soft px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                  Cara claim API key gratis
                </p>
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
                        className="underline decoration-ink-line underline-offset-2 hover:text-fog"
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
          </div>

          {/* sidebar */}
          <aside className="order-1 h-fit min-w-0 space-y-4 lg:order-2 lg:sticky lg:top-20">
            <div className="space-y-4 rounded-[8px] border border-ink-line bg-ink-soft p-5">
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-[6px] bg-ember px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ember-soft"
                >
                  Dapatkan API key
                  <span aria-hidden>↗</span>
                </a>
              )}

              {p.baseUrl && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-mute">Base URL</p>
                  <code className="block overflow-x-auto whitespace-nowrap rounded-[4px] border border-ink-line bg-ink px-3 py-2 font-mono text-[12px] text-fog">
                    {p.baseUrl}
                  </code>
                </div>
              )}

              <div className="space-y-2.5 border-t border-ink-line pt-4">
                {p.freeLimit && (
                  <Fact label="Rate limit">
                    <span className="text-grass">{p.freeLimit}</span>
                  </Fact>
                )}
                <Fact label="Context maks">{p.maxContext ?? "—"}</Fact>
                <Fact label="Jumlah model">{p.modelCount}</Fact>
                {p.domain && (
                  <Fact label="Domain">
                    <a
                      href={`https://${p.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-fog underline decoration-ink-line underline-offset-2 transition-colors hover:decoration-mute"
                    >
                      {p.domain}
                    </a>
                  </Fact>
                )}
              </div>

              <div className="border-t border-ink-line pt-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                  Sumber data
                </p>
                <SourceLine sources={p.sources} />
                <p className="mt-2 text-[11px] leading-relaxed text-mute">
                  Kami aggregator — bukan verifier, bukan pemilik datanya. Kalau ada
                  yang ga akurat,{" "}
                  <a
                    href={p.sources[0]?.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-ink-line underline-offset-2 hover:text-fog"
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
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
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
      </main>
    </div>
  );
}
