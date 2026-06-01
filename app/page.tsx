import Navbar from "@/components/Navbar";
import DirectoryClient from "./directory/DirectoryClient";
import { getListItems, getLastUpdated } from "@/lib/data";

const principles = [
  {
    title: "Aggregator, bukan verifier",
    body: "Data dikumpulin dari sumber komunitas tepercaya, ditampilin apa adanya — lengkap sama atribusi & link sumbernya.",
  },
  {
    title: "Synced, bukan “verified”",
    body: "Tiap provider nampilin terakhir di-sync kapan & dari sumber mana — trust dari transparansi, bukan dari klaim.",
  },
  {
    title: "Apa adanya, ga nebak",
    body: "Cuma nampilin yang ada di sumber — model, context, rate limit, modality. Ga ada field tebakan atau kolom kosong.",
  },
];

export default function Home() {
  const items = getListItems();
  const count = items.length;
  const totalModels = items.reduce((n, p) => n + p.modelCount, 0);
  const lastUpdatedIso = getLastUpdated();
  const lastUpdated = lastUpdatedIso
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(lastUpdatedIso))
    : null;

  return (
    <div className="min-h-dvh pb-12">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-3xl pt-16 text-center sm:pt-24">
          <h1 className="font-serif text-4xl font-medium leading-[1.04] tracking-tight text-fog sm:text-5xl md:text-6xl">
            API AI yang bisa
            <br />
            dipake gratis
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-mute sm:text-lg">
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
        <section id="direktori" className="mt-12 scroll-mt-20 sm:mt-16">
          {lastUpdated && (
            <p className="mb-3 text-right text-xs text-mute opacity-50">
              Last update {lastUpdated}. Udah stale? DM{" "}
              <a
                href="https://instagram.com/raymondchins"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-fog underline decoration-ink-line underline-offset-2 hover:decoration-mute"
              >
                @raymondchins
              </a>{" "}
              suruh gw update.
            </p>
          )}
          <DirectoryClient items={items} />
        </section>

        {/* ── How it works ── */}
        <section id="cara-kerja" className="mt-16 scroll-mt-20 sm:mt-24">
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

        {/* ── Kenapa ── */}
        <section className="mt-16 text-center sm:mt-24">
          <p className="mx-auto max-w-2xl text-balance font-serif text-2xl leading-snug tracking-tight text-fog sm:text-3xl">
            Kenapa gw bikin ini? Karena ✨gratis✨ itu indah, dan gw tau banyak
            dev yang baru belajar suka kepentok token. This is for you guys,
            lets build!
          </p>
          <p className="mx-auto mt-5 max-w-xl text-balance font-serif text-xl leading-snug tracking-tight text-mute sm:text-2xl">
            Punya project AI / suka ngulik AI? Daftar di{" "}
            <a
              href="https://genesis.ceo"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-2 underline-offset-4 transition-colors hover:text-grass"
            >
              genesis.ceo
            </a>{" "}
            :)
          </p>
        </section>
      </main>
    </div>
  );
}
