import Link from "next/link";
import Navbar from "@/components/Navbar";
import Spark from "@/components/Spark";
import DirectoryClient from "./directory/DirectoryClient";
import { getAllProviders } from "@/lib/data";

const principles = [
  {
    title: "Aggregator, bukan verifier",
    body: "Data dikumpulin dari sumber komunitas yang udah dipercaya, lalu ditampilin apa adanya — lengkap sama atribusi & link sumbernya.",
  },
  {
    title: "Synced, bukan “verified”",
    body: "Tiap provider nampilin terakhir di-sync kapan dan dari mana. Trust dari transparansi, bukan dari klaim.",
  },
  {
    title: "Apa adanya, ga nebak",
    body: "Cuma nampilin yang beneran ada di sumber — model, context window, rate limit, modality. Ga ada field tebakan, ga ada kolom “Unknown” kosong.",
  },
];

export default function Home() {
  const providers = getAllProviders();
  const count = providers.length;
  const totalModels = providers.reduce((n, p) => n + p.modelCount, 0);

  return (
    <div className="min-h-dvh pb-24">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-3xl pt-16 text-center sm:pt-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-grass-line bg-grass-bg px-3 py-1 text-xs font-medium text-grass">
            ✅ {count} provider · {totalModels} model gratis
          </span>

          <h1 className="mt-6 text-balance font-serif text-5xl font-semibold leading-[1.04] tracking-tight text-fog sm:text-6xl">
            API AI yang bisa dipake gratis
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-mute">
            Free tier &amp; free credits API LLM — di-aggregate otomatis dari
            sumber komunitas. Tiap provider nampilin{" "}
            <span className="font-medium text-fog">
              model, context window, rate limit &amp; modality
            </span>{" "}
            apa adanya dari sumber.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="#direktori"
              className="inline-flex items-center gap-2 rounded-xl bg-ember px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-ember-soft"
            >
              <Spark className="h-4 w-4" />
              Lihat direktori
            </Link>
            <Link
              href="#cara-kerja"
              className="inline-flex items-center gap-2 rounded-xl border border-ink-line bg-ink-soft px-6 py-3 text-sm font-semibold text-fog transition-colors hover:border-fog/40"
            >
              Cara kerja
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>

        {/* ── Trust / source ── */}
        <section className="mt-16 text-center">
          <p className="text-sm text-mute">Di-aggregate dari sumber komunitas</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <a
              href="https://github.com/mnfst/awesome-free-llm-apis"
              target="_blank"
              rel="noopener noreferrer"
              className="font-serif text-sm font-medium tracking-tight text-fog/60 transition-colors hover:text-fog"
            >
              mnfst/awesome-free-llm-apis
            </a>
            <span className="font-serif text-sm font-medium tracking-tight text-fog/40">
              cheahjs/free-llm-api-resources
            </span>
            <span className="font-serif text-sm font-medium tracking-tight text-fog/40">
              aicredits.dev
            </span>
          </div>
        </section>

        {/* ── Directory table ── */}
        <section id="direktori" className="mt-16 scroll-mt-20">
          <DirectoryClient providers={providers} />
        </section>

        {/* ── How it works ── */}
        <section id="cara-kerja" className="mt-24 scroll-mt-20">
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-fog">
            Cara kerja
          </h2>
          <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-ink-line bg-ink-line sm:grid-cols-3">
            {principles.map((p) => (
              <div key={p.title} className="bg-ink-soft p-6">
                <h3 className="font-serif text-base font-semibold tracking-tight text-fog">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-mute">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer id="sumber" className="mt-24 border-t border-ink-line pt-8 text-sm text-mute scroll-mt-20">
          <p className="max-w-2xl">
            Sumber data:{" "}
            <a
              href="https://github.com/mnfst/awesome-free-llm-apis"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-ink-line underline-offset-2 hover:text-fog"
            >
              mnfst/awesome-free-llm-apis
            </a>
            . Di-sync otomatis dari `data.json` sumber. Kita aggregator — bukan
            verifier, bukan pemilik datanya.
          </p>
          <p className="mt-3 text-xs text-mute/70">
            <span className="font-medium text-mute">tokengratis.id</span> · ga dimonetisasi.
          </p>
        </footer>
      </main>
    </div>
  );
}
