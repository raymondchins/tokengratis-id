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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: "https://tokengratis.id/sitemap.xml",
  };
}
