import Navbar from "@/components/Navbar";
import { getListItems } from "@/lib/data";
import DirectoryClient from "./DirectoryClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Direktori — tokengratis.id",
  description:
    "List provider AI dengan free tier & free credits API. Di-aggregate dari sumber komunitas — model, context, rate limit, modality apa adanya.",
  alternates: { canonical: "https://tokengratis.id/directory" },
  openGraph: {
    title: "Direktori API AI Gratis — tokengratis.id",
    description:
      "List provider AI dengan free tier & free credits API. Di-aggregate dari sumber komunitas — model, context, rate limit, modality apa adanya.",
    url: "https://tokengratis.id/directory",
    siteName: "tokengratis.id",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Direktori API AI Gratis — tokengratis.id",
    description:
      "List provider AI dengan free tier & free credits API. Di-aggregate dari sumber komunitas.",
  },
};

export default function DirectoryPage() {
  const items = getListItems();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Direktori API AI Gratis",
    url: "https://tokengratis.id/directory",
    inLanguage: "id",
    numberOfItems: items.length,
    itemListElement: items.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://tokengratis.id/provider/${p.slug}`,
      name: p.name,
    })),
  };

  return (
    <div className="min-h-dvh pb-24">
      <Navbar />

      <main id="main-content" className="mx-auto max-w-5xl px-4 sm:px-6">
        <header className="pt-10 sm:pt-14 md:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mute">
            Direktori API AI gratis
          </p>
          <h1 className="mt-4 font-serif text-3xl font-semibold leading-tight tracking-tight text-fog sm:text-4xl md:text-5xl">
            Semua provider di satu tempat.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-mute">
            Free tier &amp; free credits API LLM dari berbagai provider — di-aggregate
            otomatis dari sumber komunitas. Situs ini{" "}
            <span className="font-medium text-fog">aggregator</span>, bukan verifier:
            cuma nampilin yang beneran ada di sumber, ga nebak.
          </p>
        </header>

        <section className="mt-8 sm:mt-10">
          <DirectoryClient items={items} />
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </main>
    </div>
  );
}
