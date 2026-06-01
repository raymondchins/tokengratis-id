import type { MetadataRoute } from "next";
import { getAllProviders } from "@/lib/data";

const BASE = "https://tokengratis.id";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/directory`, changeFrequency: "daily", priority: 0.9 },
  ];
  const providerRoutes: MetadataRoute.Sitemap = getAllProviders().map((p) => ({
    url: `${BASE}/provider/${p.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  return [...staticRoutes, ...providerRoutes];
}
