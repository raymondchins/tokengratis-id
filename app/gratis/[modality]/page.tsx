import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "next-view-transitions";
import Navbar from "@/components/Navbar";
import ProviderLogo from "@/components/ProviderLogo";
import { MODALITY_ORDER, modalityLabel } from "@/components/directory/Badges";
import { getAllProviders, getLastUpdated } from "@/lib/data";
import { ctxNum } from "@/lib/ctxnum";
import type { Modality, Model, Provider } from "@/lib/types";

const BASE = "https://tokengratis.id";

/**
 * Facet pages only exist for modalities that clear a thin-content floor:
 * - >=3 providers actually carry it (provider-level `p.modalities`, the same
 *   flag FilterBar / DirectoryClient use elsewhere in the app)
 * - excludes "text" — 24/24 providers have it, so a /gratis/text page would
 *   just duplicate the homepage directory.
 * MUST be kept in sync with the identical check in app/sitemap.ts and the
 * "Jelajah" facet-link block in components/Footer.tsx (both live outside this
 * route file and can't safely import from it).
 */
const MIN_PROVIDERS = 3;
const EXCLUDED_FACETS: Modality[] = ["text"];

function eligibleModalities(providers: Provider[]): Modality[] {
  const counts = new Map<Modality, number>();
  for (const p of providers) {
    for (const m of p.modalities) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return MODALITY_ORDER.filter(
    (m) => (counts.get(m) ?? 0) >= MIN_PROVIDERS && !EXCLUDED_FACETS.includes(m),
  );
}

/**
 * Per-model facet match — mirrors `facetsOf()` in scripts/lib/normalize.mjs
 * (same regexes against the raw `model.modality` string from source). Kept as
 * a separate read-only copy here: normalize.mjs is a pipeline-only Node
 * script, not importable into this route. Used to compute a REAL
 * per-provider model count for this facet (not just the provider-level flag)
 * — if a provider carries the facet at the aggregate level but none of its
 * individual models back it up (source drift), it's excluded from this page
 * rather than shown with a hallucinated "0 model" row.
 */
const MODALITY_PATTERN: Record<Modality, RegExp> = {
  text: /text|multimodal|llm|mllm|aigc|roleplay|reasoning|safety/,
  vision: /vision/,
  image: /image/,
  audio: /audio|speech/,
  video: /video/,
  code: /\bcode\b/,
  embeddings: /embed/,
  reranking: /rerank/,
};

function modelMatchesFacet(model: Model, facet: Modality): boolean {
  if (!model.modality) return false;
  return MODALITY_PATTERN[facet].test(model.modality.toLowerCase());
}

type FacetRow = { provider: Provider; modelCount: number; maxContext: string | null };

function getFacetData(modalityParam: string) {
  const providers = getAllProviders();
  const eligible = eligibleModalities(providers);
  const facet = eligible.find((m) => m === modalityParam);
  if (!facet) return null;

  const rows: FacetRow[] = providers
    .filter((p) => p.modalities.includes(facet))
    .map((p) => {
      const matchingModels = p.models.filter((m) => modelMatchesFacet(m, facet));
      let maxContext: string | null = null;
      for (const m of matchingModels) {
        if (ctxNum(m.context) > ctxNum(maxContext)) maxContext = m.context;
      }
      return { provider: p, modelCount: matchingModels.length, maxContext };
    })
    .filter((r) => r.modelCount > 0)
    .sort((a, b) => b.modelCount - a.modelCount);

  const totalModels = rows.reduce((sum, r) => sum + r.modelCount, 0);
  return { facet, rows, totalModels };
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
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

export async function generateStaticParams() {
  return eligibleModalities(getAllProviders()).map((modality) => ({ modality }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ modality: string }>;
}): Promise<Metadata> {
  const { modality } = await params;
  const data = getFacetData(modality);
  if (!data) return {};
  const label = modalityLabel(data.facet);
  const title = `API ${label} Gratis — ${data.rows.length} Provider Free Tier | tokengratis.id`;
  const description = `${data.rows.length} provider nampilin model ${label} di free tier-nya — ${data.totalModels} model, di-aggregate otomatis dari sumber komunitas.`;
  const canonical = `${BASE}/gratis/${modality}`;
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

export default async function GratisModalityPage({
  params,
}: {
  params: Promise<{ modality: string }>;
}) {
  const { modality } = await params;
  const data = getFacetData(modality);
  if (!data) notFound();

  const { facet, rows, totalModels } = data;
  const label = modalityLabel(facet);
  const syncedLabel = fmtDate(getLastUpdated());

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `API ${label} Gratis`,
    url: `${BASE}/gratis/${modality}`,
    inLanguage: "id",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: rows.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE}/provider/${r.provider.slug}`,
        name: r.provider.name,
      })),
    },
  };

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

        {/* hero */}
        <header className="max-w-2xl border-b border-ink-line pb-8">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-fog sm:text-4xl">
            API {label} Gratis
          </h1>
          <p className="mt-4 text-base leading-relaxed text-mute">
            <span className="font-semibold text-fog">{rows.length} provider</span>{" "}
            nampilin model {label} di free tier-nya — {totalModels} model per{" "}
            {syncedLabel}.
          </p>
        </header>

        {/* table */}
        <section className="mt-8 overflow-hidden rounded-[8px] border border-ink-line bg-ink-soft">
          <div className="overflow-x-auto">
            <div
              aria-hidden="true"
              className="hidden min-w-[640px] grid-cols-[minmax(190px,1.8fr)_minmax(140px,1fr)_minmax(140px,1fr)_108px] items-center gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-mute md:grid"
            >
              <span>Provider</span>
              <span>Model {label}</span>
              <span>Context maks</span>
              <span className="text-right">Aksi</span>
            </div>
            <div className="min-w-[640px] md:min-w-0">
              {rows.map((r) => (
                <Link
                  key={r.provider.slug}
                  href={`/provider/${r.provider.slug}`}
                  aria-label={`${r.provider.name} — ${r.modelCount} model ${label}`}
                  className="group flex flex-col gap-3 border-t border-ink-line px-4 py-4 transition-colors first:border-t-0 hover:bg-ink/40 focus-visible:bg-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog focus-visible:ring-inset sm:px-5 md:grid md:grid-cols-[minmax(190px,1.8fr)_minmax(140px,1fr)_minmax(140px,1fr)_108px] md:items-center md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ProviderLogo
                      logo={r.provider.logo}
                      flag={r.provider.flag}
                      name={r.provider.name}
                      className="h-9 w-9"
                    />
                    <span className="truncate font-semibold text-fog">
                      {r.provider.name}
                    </span>
                  </div>
                  <div className="text-sm text-fog">
                    {r.modelCount} model
                  </div>
                  <div className="text-sm text-fog">{r.maxContext ?? "—"}</div>
                  <div className="flex md:justify-end">
                    <span className="inline-flex items-center rounded-[6px] bg-ember px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-ember-soft">
                      Lihat
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* footer note */}
        <p className="mt-6 max-w-2xl text-[11px] leading-relaxed text-mute">
          tokengratis.id aggregator — bukan verifier, bukan pemilik datanya. Data
          di-sync otomatis dari sumber komunitas.{" "}
          <Link
            href="/"
            className="underline decoration-ink-line underline-offset-2 hover:text-fog"
          >
            Kembali ke beranda
          </Link>
          .
        </p>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      </main>
    </div>
  );
}
