import type { MetadataRoute } from "next";
import { getAllProviders, getLastUpdated } from "@/lib/data";
import { getOpenSourceSyncedAt } from "@/lib/opensource-data";
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
  return [...staticRoutes, ...providerRoutes, ...facetRoutes, ...modelRoutes, ...changelogRoute];
}
