import Navbar from "@/components/Navbar";
import { getAllProviders } from "@/lib/data";
import DirectoryClient from "./DirectoryClient";

export const metadata = {
  title: "Direktori — tokengratis.id",
  description:
    "List provider AI dengan free tier & free credits API. Di-aggregate dari sumber komunitas — model, context, rate limit, modality apa adanya.",
};

export default function DirectoryPage() {
  const providers = getAllProviders();

  return (
    <div className="min-h-dvh pb-24">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6">
        <header className="pt-14 sm:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mute">
            Direktori API AI gratis
          </p>
          <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight tracking-tight text-fog sm:text-5xl">
            Semua provider di satu tempat.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-mute">
            Free tier &amp; free credits API LLM dari berbagai provider — di-aggregate
            otomatis dari sumber komunitas. Situs ini{" "}
            <span className="font-medium text-fog">aggregator</span>, bukan verifier:
            cuma nampilin yang beneran ada di sumber, ga nebak.
          </p>
        </header>

        <section className="mt-10">
          <DirectoryClient providers={providers} />
        </section>

        <footer className="mt-20 border-t border-ink-line pt-8 text-sm text-mute">
          <p>
            Sumber data: mnfst/awesome-free-llm-apis (data.json). Di-sync otomatis
            dari sumber.
          </p>
          <p className="mt-2 text-xs text-mute/70">
            <span className="font-medium text-mute">tokengratis.id</span> · ga dimonetisasi.
          </p>
        </footer>
      </main>
    </div>
  );
}
