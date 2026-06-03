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
          {children}
          <Footer />
          <Analytics />
          <CloudflareAnalytics />
        </body>
      </html>
    </ViewTransitions>
  );
}
