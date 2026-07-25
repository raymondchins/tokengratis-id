import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import PilihClient from "./PilihClient";
import { getAllProviders } from "@/lib/data";
import type { WizardProvider } from "@/lib/wizard";

export const metadata: Metadata = {
  title: "Model apa buat gw? — Cari Model AI Gratis | tokengratis.id",
  description:
    "Pilih kebutuhan, context window, dan preferensi rate limit — tokengratis.id kasih rekomendasi model AI gratis yang paling cocok, langsung dari data sumber. Aggregator transparan, bukan verifier.",
  alternates: { canonical: "https://tokengratis.id/pilih" },
  openGraph: {
    title: "Model apa buat gw? — Cari Model AI Gratis | tokengratis.id",
    description:
      "Pilih kebutuhan, context window, dan preferensi rate limit — dapet rekomendasi model AI gratis yang paling cocok, langsung dari data sumber.",
    url: "https://tokengratis.id/pilih",
    siteName: "tokengratis.id",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Model apa buat gw? — Cari Model AI Gratis | tokengratis.id",
    description:
      "Pilih kebutuhan, context window, dan preferensi rate limit — dapet rekomendasi model AI gratis yang paling cocok, langsung dari data sumber.",
    creator: "@raymondchins",
  },
};

export default function PilihPage() {
  // Slim payload — ikutin filosofi ProviderListItem (lib/data.ts): cuma
  // field yang kepake wizard yang dikirim ke client, biar bundle kecil.
  const providers: WizardProvider[] = getAllProviders().map((p) => ({
    slug: p.slug,
    name: p.name,
    logo: p.logo,
    flag: p.flag,
    modalities: p.modalities,
    models: p.models,
  }));

  return (
    <div className="min-h-dvh pb-24">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-3xl px-4 pt-16 sm:px-6 sm:pt-24">
        {/* ── Hero ── */}
        <section className="text-center">
          <h1 className="font-serif text-4xl font-medium leading-[1.04] tracking-tight text-fog sm:text-5xl">
            Model apa buat gw?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-mute sm:text-lg">
            Ga usah scan {providers.reduce((n, p) => n + p.models.length, 0)} model satu-satu.{" "}
            <span className="font-medium text-fog">
              Pilih kebutuhan kamu, langsung keluar rekomendasi
            </span>{" "}
            — dibangun cuma dari data yang beneran ada, ga ada tebakan.
          </p>
        </section>

        {/* ── Wizard ── */}
        <section className="mt-12 sm:mt-16">
          <PilihClient providers={providers} />
        </section>
      </main>
    </div>
  );
}
