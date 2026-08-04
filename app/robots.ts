import type { MetadataRoute } from "next";

// Named AI-crawler allow rules, explicit alongside the wildcard "*" rule below —
// belt-and-suspenders so bots that key off their own UA name (rather than
// relying on the wildcard) still get an unambiguous allow.
const AI_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "Claude-Web",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "Bingbot",
  "meta-externalagent",
];

// Route gambar OG bikinan Next.js (`/opengraph-image?<hash>`,
// `/provider/<slug>/opengraph-image?<hash>`). Itu file PNG, bukan halaman —
// tapi Google nge-crawl-nya sebagai halaman lalu naruh di "Crawled - currently
// not indexed" (kelihatan di GSC 2026-08-03). Buang-buang crawl budget di
// domain yang halaman aslinya aja masih ngantri di-index. Di-disallow di sini
// GA ngaruh ke preview sosial — Facebook/Twitter/WhatsApp ngambil gambarnya
// dari tag `og:image`, ga lewat crawl organik.
const OG_IMAGE_PATH = "/*/opengraph-image";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: [OG_IMAGE_PATH, "/opengraph-image"] },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: [OG_IMAGE_PATH, "/opengraph-image"],
      })),
    ],
    sitemap: "https://tokengratis.id/sitemap.xml",
  };
}
