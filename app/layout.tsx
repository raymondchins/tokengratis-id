import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ViewTransitions } from "next-view-transitions";
import "./globals.css";
import Footer from "@/components/Footer";
import CloudflareAnalytics from "@/components/CloudflareAnalytics";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "tokengratis.id — Direktori API AI gratis",
  description:
    "Kumpulan free tier & free credits API LLM, di-aggregate otomatis dari sumber komunitas. Tiap provider nampilin model, context window, rate limit & modality apa adanya. Aggregator transparan, bukan verifier.",
  metadataBase: new URL("https://tokengratis.id"),
  alternates: { canonical: "https://tokengratis.id" },
  openGraph: {
    title: "tokengratis.id — Direktori API AI gratis",
    description:
      "Free tier & free credits API LLM, di-aggregate dari sumber komunitas. Aggregator transparan, bukan verifier.",
    url: "https://tokengratis.id",
    siteName: "tokengratis.id",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "tokengratis.id — Direktori API AI gratis",
    description:
      "Free tier & free credits API LLM, di-aggregate dari sumber komunitas.",
    creator: "@raymondchins",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewTransitions>
      <html lang="id" className={inter.variable}>
        <body>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:border focus:border-ink-line focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-fog"
          >
            Lewati ke konten
          </a>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "tokengratis.id",
                url: "https://tokengratis.id",
                description:
                  "Direktori free tier & free credits API LLM, di-aggregate dari sumber komunitas.",
                inLanguage: "id",
                author: {
                  "@type": "Person",
                  name: "Raymond Chin",
                  url: "https://instagram.com/raymondchins",
                },
              }).replace(/</g, "\\u003c"),
            }}
          />
          {children}
          <Footer />
          <Analytics />
          <CloudflareAnalytics />
        </body>
      </html>
    </ViewTransitions>
  );
}
