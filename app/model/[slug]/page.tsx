import { getModelClusters, getClusterBySlug } from "@/lib/model-clusters";
import { notFound } from "next/navigation";
import { Link } from "next-view-transitions";
import Navbar from "@/components/Navbar";
import { modalityLabel, SourceLine } from "@/components/directory/Badges";
import type { Modality } from "@/lib/types";
import type { ModelCluster } from "@/lib/model-clusters";

// Facet yang punya halaman /gratis/{modality} live (lihat app/gratis/*).
// Sengaja BUKAN semua Modality — text/embeddings/reranking ga punya route.
const LINKABLE_MODALITIES: Modality[] = ["vision", "image", "code", "video", "audio"];

/** Derive facet dari string modality mentah tiap model di cluster (union). */
function linkableModalitiesOf(cluster: ModelCluster): Modality[] {
  const raw = cluster.entries
    .map((e) => e.model.modality)
    .filter((m): m is string => !!m)
    .join(" ")
    .toLowerCase();
  return LINKABLE_MODALITIES.filter((facet) => {
    switch (facet) {
      case "vision":
        return /vision/.test(raw);
      case "image":
        return /image/.test(raw);
      case "audio":
        return /audio|speech/.test(raw);
      case "video":
        return /video/.test(raw);
      case "code":
        return /\bcode\b/.test(raw);
      default:
        return false;
    }
  });
}

export async function generateStaticParams() {
  return getModelClusters().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cluster = getClusterBySlug(slug);
  if (!cluster) return {};

  const providerCount = new Set(cluster.entries.map((e) => e.provider.slug)).size;
  const providerNames = cluster.entries.map((e) => e.provider.name).join(", ");
  const title = `${cluster.displayName} Gratis — Tersedia di ${providerCount} Provider | tokengratis.id`;
  const description = `${cluster.displayName} tersedia gratis di ${providerCount} provider: ${providerNames}. Bandingkan context window, rate limit, dan link klaim API key tiap provider.`;
  const canonical = `https://tokengratis.id/model/${cluster.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-mute first:pl-5 last:pr-5">
      {children}
    </th>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cluster = getClusterBySlug(slug);
  if (!cluster) notFound();

  const providerCount = new Set(cluster.entries.map((e) => e.provider.slug)).size;
  const canonical = `https://tokengratis.id/model/${cluster.slug}`;
  const linkableModalities = linkableModalitiesOf(cluster);

  // Anti-halusinasi: kolom cuma dibikin kalau minimal satu entry beneran
  // punya nilainya — bukan "—" bertaburan buat field yang emang ga ada di
  // sumber manapun buat cluster ini.
  const showContext = cluster.entries.some((e) => e.model.context);
  const showMaxOutput = cluster.entries.some((e) => e.model.maxOutput);
  const showRateLimit = cluster.entries.some((e) => e.model.rateLimit);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "tokengratis.id",
        item: "https://tokengratis.id",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: `${cluster.displayName} Gratis`,
        item: canonical,
      },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Provider yang nyediain ${cluster.displayName} gratis`,
    itemListElement: cluster.entries.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.provider.name,
      url: `https://tokengratis.id/provider/${e.provider.slug}`,
    })),
  };

  return (
    <div className="min-h-dvh pb-24">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        {/* back */}
        <Link
          href="/"
          className="group mb-8 inline-flex items-center gap-1.5 text-sm text-mute transition-colors hover:text-fog"
        >
          <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
            ←
          </span>
          Kembali ke beranda
        </Link>

        {/* hero header */}
        <header className="border-b border-ink-line pb-8">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-fog sm:text-4xl">
            {cluster.displayName} — API Gratis
          </h1>
          <p className="mt-3 text-sm text-mute">
            Tersedia di <span className="font-medium text-fog">{providerCount} provider</span>{" "}
            free tier
          </p>

          {linkableModalities.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {linkableModalities.map((m) => (
                <Link
                  key={m}
                  href={`/gratis/${m}`}
                  className="inline-flex items-center rounded-full border border-ink-line bg-ink-soft px-3 py-1 text-xs font-medium text-mute transition-colors hover:border-mute hover:text-fog"
                >
                  Model {modalityLabel(m)} gratis lainnya →
                </Link>
              ))}
            </div>
          )}
        </header>

        {/* disclaimer anti-halusinasi (WAJIB) */}
        <section className="mt-6 rounded-[8px] border border-ink-line bg-ink-soft px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mute">
            Catatan
          </p>
          <p className="mt-2 text-sm leading-relaxed text-fog">
            Provider di bawah nyantumin model dengan nama yang sama menurut sumber
            masing-masing — versi/kuantisasi bisa beda antar provider. Cek detail di
            provider.
          </p>
        </section>

        {/* tabel provider */}
        <section className="mt-6 overflow-hidden rounded-[8px] border border-ink-line bg-ink-soft">
          <div className="border-b border-ink-line px-5 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mute">
              {providerCount} provider nyediain {cluster.displayName}
            </p>
          </div>

          {/* mobile cards */}
          <div className="divide-y divide-ink-line md:hidden">
            {cluster.entries.map((e) => (
              <div key={e.provider.slug} className="px-4 py-3.5">
                <Link
                  href={`/provider/${e.provider.slug}`}
                  className="font-medium text-fog underline decoration-ink-line underline-offset-2 hover:text-fog"
                >
                  {e.provider.name}
                </Link>
                <div className="mt-1 break-all font-mono text-[11px] text-mute">
                  {e.model.id}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {showContext && (
                    <div>
                      <dt className="font-semibold uppercase tracking-wider text-mute">
                        Context
                      </dt>
                      <dd className="font-medium text-fog">{e.model.context ?? "—"}</dd>
                    </div>
                  )}
                  {showMaxOutput && (
                    <div>
                      <dt className="font-semibold uppercase tracking-wider text-mute">
                        Output
                      </dt>
                      <dd className="text-fog">{e.model.maxOutput ?? "—"}</dd>
                    </div>
                  )}
                  {showRateLimit && e.model.rateLimit && (
                    <div className="col-span-2">
                      <dt className="font-semibold uppercase tracking-wider text-mute">
                        Rate limit
                      </dt>
                      <dd className="text-fog">{e.model.rateLimit}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-2">
                  <SourceLine sources={[e.source]} />
                </p>
              </div>
            ))}
          </div>

          {/* desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <Th>Provider</Th>
                  <Th>Model (id sumber)</Th>
                  {showContext && <Th>Context</Th>}
                  {showMaxOutput && <Th>Output</Th>}
                  {showRateLimit && <Th>Rate limit</Th>}
                  <Th>Sumber</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line border-t border-ink-line">
                {cluster.entries.map((e) => (
                  <tr key={e.provider.slug} className="align-top transition-colors hover:bg-ink/50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/provider/${e.provider.slug}`}
                        className="font-medium text-fog underline decoration-ink-line underline-offset-2 hover:text-fog"
                      >
                        {e.provider.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <code className="break-all rounded-[3px] border border-ink-line bg-ink px-1.5 py-0.5 font-mono text-[12px] text-fog">
                        {e.model.id}
                      </code>
                    </td>
                    {showContext && (
                      <td className="px-3 py-3 font-medium text-fog">
                        {e.model.context ?? "—"}
                      </td>
                    )}
                    {showMaxOutput && (
                      <td className="px-3 py-3 text-mute">{e.model.maxOutput ?? "—"}</td>
                    )}
                    {showRateLimit && (
                      <td className="px-3 py-3 text-mute">{e.model.rateLimit ?? "—"}</td>
                    )}
                    <td className="px-5 py-3">
                      <SourceLine sources={[e.source]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(itemListJsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </main>
    </div>
  );
}
