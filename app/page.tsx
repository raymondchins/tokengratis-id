import Navbar from "@/components/Navbar";
import DirectoryClient from "./directory/DirectoryClient";
import { getListItems } from "@/lib/data";

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
  const items = getListItems();
  const count = items.length;
  const totalModels = items.reduce((n, p) => n + p.modelCount, 0);

  return (
    <div className="min-h-dvh pb-24">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-3xl pt-16 text-center sm:pt-24">
          <h1 className="font-serif text-5xl font-medium leading-[1.04] tracking-tight text-fog sm:text-6xl">
            API AI yang bisa
            <br />
            dipake gratis
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-mute">
            Free tier &amp; free credits API LLM — di-aggregate otomatis dari
            sumber komunitas. Tiap provider nampilin{" "}
            <span className="font-medium text-fog">
              model, context window, rate limit &amp; modality
            </span>{" "}
            apa adanya dari sumber.
          </p>

          <span className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-grass-line bg-grass-bg px-3 py-1 text-xs font-medium text-grass">
            ✅ {count} provider · {totalModels} model gratis
          </span>
        </section>

        {/* ── Directory table ── */}
        <section id="direktori" className="mt-16 scroll-mt-20">
          <DirectoryClient items={items} />
        </section>

        {/* ── How it works ── */}
        <section id="cara-kerja" className="mt-24 scroll-mt-20">
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-fog">
            Cara kerja
          </h2>
          <div className="mt-6 grid gap-px overflow-hidden rounded-[8px] border border-ink-line bg-ink-line sm:grid-cols-3">
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
      </main>
    </div>
  );
}
