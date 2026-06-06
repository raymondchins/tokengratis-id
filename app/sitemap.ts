import type { MetadataRoute } from "next";
import { getAllProviders, getLastUpdated } from "@/lib/data";

const BASE = "https://tokengratis.id";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastUpdatedStr = getLastUpdated();
  const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1, lastModified: lastUpdated },
  ];
  const providerRoutes: MetadataRoute.Sitemap = getAllProviders().map((p) => ({
    url: `${BASE}/provider/${p.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
    lastModified: p.sourceUpdatedAt ? new Date(p.sourceUpdatedAt) : (p.syncedAt ? new Date(p.syncedAt) : lastUpdated),
  }));
  return [...staticRoutes, ...providerRoutes];
}
