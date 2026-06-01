import type { Metadata } from "next";
import { Work_Sans } from "next/font/google";
import "./globals.css";

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "tokengratis.id — Direktori AI gratis, Indonesia-first",
  description:
    "Kumpulan free tier & free credits AI, di-aggregate otomatis dari sumber komunitas, di-filter buat akses dari Indonesia. Transparan: tiap data ada sumber + tanggal sync.",
  metadataBase: new URL("https://tokengratis.id"),
  openGraph: {
    title: "tokengratis.id",
    description:
      "Direktori free tier & free credits AI, Indonesia-first. Aggregator transparan, bukan verifier.",
    url: "https://tokengratis.id",
    siteName: "tokengratis.id",
    locale: "id_ID",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={workSans.variable}>
      <body>{children}</body>
    </html>
  );
}
