import type { MetadataRoute } from "next";
import { getAllProviders, getLastUpdated } from "@/lib/data";
import { getOpenSourceSyncedAt } from "@/lib/opensource-data";
import { getAllOffers } from "@/lib/offers-data";
import { getModelClusters } from "@/lib/model-clusters";
import { MODALITY_ORDER } from "@/components/directory/Badges";
import type { Modality } from "@/lib/types";

const BASE = "https://tokengratis.id";

/**
 * Facet URLs eligible for /gratis/<modality> — MUST mirror the identical
 * eligibility check in app/gratis/[modality]/page.tsx (generateStaticParams)
 * and the "Jelajah" link block in components/Footer.tsx: modality needs >=3
 * providers (provider-level `p.modalities`) AND isn't "text" (24/24
 * providers — would just duplicate the homepage directory). Kept as a
 * separate copy in each file since route/component files can't import from
 * one another here.
 */
const MIN_FACET_PROVIDERS = 3;
const EXCLUDED_FACETS: Modality[] = ["text"];

function eligibleFacetModalities(providers: ReturnType<typeof getAllProviders>): Modality[] {
  const counts = new Map<Modality, number>();
  for (const p of providers) {
    for (const m of p.modalities) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return MODALITY_ORDER.filter(
    (m) => (counts.get(m) ?? 0) >= MIN_FACET_PROVIDERS && !EXCLUDED_FACETS.includes(m),
  );
}

export default function sitemap(): MetadataRoute.Sitemap {
  const providers = getAllProviders();
  const lastUpdatedStr = getLastUpdated();
  const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1, lastModified: lastUpdated },
    {
      url: `${BASE}/opensource`,
      changeFrequency: "daily",
      priority: 0.9,
      lastModified: new Date(getOpenSourceSyncedAt()),
    },
  ];
  const providerRoutes: MetadataRoute.Sitemap = providers.map((p) => ({
    url: `${BASE}/provider/${p.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
    lastModified: p.sourceUpdatedAt ? new Date(p.sourceUpdatedAt) : (p.syncedAt ? new Date(p.syncedAt) : lastUpdated),
  }));
  const facetRoutes: MetadataRoute.Sitemap = eligibleFacetModalities(providers).map((m) => ({
    url: `${BASE}/gratis/${m}`,
    changeFrequency: "weekly",
    priority: 0.6,
    lastModified: lastUpdated,
  }));
  const modelRoutes: MetadataRoute.Sitemap = getModelClusters().map((c) => ({
    url: `${BASE}/model/${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
    lastModified: lastUpdated,
  }));
  const changelogRoute: MetadataRoute.Sitemap = [
    {
      url: `${BASE}/changelog`,
      changeFrequency: "daily",
      priority: 0.5,
      lastModified: lastUpdated,
    },
  ];

  // Alat turunan data (di-generate dari providers.json yang sama) — ikut
  // lastUpdated karena isinya berubah tiap sync.
  const toolRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/pilih`, changeFrequency: "weekly", priority: 0.8, lastModified: lastUpdated },
    { url: `${BASE}/fallback`, changeFrequency: "weekly", priority: 0.7, lastModified: lastUpdated },
  ];

  // "Modal gratis" — kurasi manual, kadens mingguan (BUKAN nightly seperti
  // dataset LLM). lastModified diambil dari checkedAt terbaru tiap offer, jadi
  // ga bohong soal kapan halamannya terakhir beneran diperiksa.
  const offers = getAllOffers();
  const offersLastChecked = offers.reduce<string | null>((max, o) => {
    for (const s of o.sources) if (!max || s.checkedAt > max) max = s.checkedAt;
    return max;
  }, null);
  const offersLastModified = offersLastChecked ? new Date(offersLastChecked) : lastUpdated;
  const offerRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE}/modal-gratis`,
      changeFrequency: "weekly",
      priority: 0.9,
      lastModified: offersLastModified,
    },
    ...offers.map((o) => ({
      url: `${BASE}/modal-gratis/${o.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      lastModified: o.sources.reduce<Date>((max, s) => {
        const d = new Date(s.checkedAt);
        return d > max ? d : max;
      }, new Date(0)),
    })),
  ];

  return [
    ...staticRoutes,
    ...providerRoutes,
    ...facetRoutes,
    ...modelRoutes,
    ...changelogRoute,
    ...toolRoutes,
    ...offerRoutes,
  ];
}
