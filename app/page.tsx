import Link from "next/link";
import providers from "@/data/providers.json";

const principles = [
  {
    title: "Aggregator, bukan verifier",
    body: "Data dikumpulin dari sumber komunitas yang udah dipercaya, lalu ditampilin apa adanya — lengkap sama atribusi & link sumbernya.",
  },
  {
    title: "Synced, bukan “verified”",
    body: "Tiap entry nampilin terakhir di-sync kapan dan dari mana. Trust dari transparansi, bukan dari klaim.",
  },
  {
    title: "Indonesia-first",
    body: "Fokus ke satu pertanyaan: ini beneran bisa diakses dari Indonesia? Kalau belum jelas, kita bilang “belum dikonfirmasi” — bukan nebak.",
  },
];

export default function Home() {
  const count = (providers as unknown[]).length;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-20 sm:py-28">
      <header className="flex items-center gap-2 text-sm font-medium tracking-tight">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-ember" />
        <span className="text-fog">tokengratis<span className="text-ember">.id</span></span>
      </header>

      <section className="mt-20 sm:mt-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mute">
          Direktori AI gratis &middot; Indonesia-first
        </p>
        <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-fog sm:text-6xl">
          Resource AI yang bisa{" "}
          <span className="text-ember">dipake gratis</span>, tanpa ngubek 12 halaman docs.
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-mute">
          Free tier & free credits buat prototyping &mdash; di-aggregate otomatis
          dari sumber komunitas, di-filter buat akses dari Indonesia. Tiap data
          punya sumber, tanggal sync, dan link aslinya.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/directory"
            className="inline-flex items-center gap-2 rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-ember-soft"
          >
            Lihat direktori &rarr;
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-line bg-ink-soft px-4 py-2 text-sm text-mute">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-ember-soft" />
            {count} offer live &middot; di-sync dari sumber komunitas
          </span>
        </div>
      </section>

      <section className="mt-20 grid gap-px overflow-hidden rounded-2xl border border-ink-line bg-ink-line sm:grid-cols-3">
        {principles.map((p) => (
          <div key={p.title} className="bg-ink-soft p-6">
            <h2 className="text-sm font-semibold text-fog">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-mute">{p.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto pt-20 text-sm text-mute">
        <p>
          Sumber data di-maintain komunitas (cheahjs/free-llm-api-resources, dll).
          Kita bukan musuh list itu &mdash; mereka sumber kita.
        </p>
        <p className="mt-2 text-xs text-ink-line">
          <span className="text-mute">tokengratis.id</span> &middot; proyek komunitas, bukan startup, ga dimonetisasi.
        </p>
      </footer>
    </main>
  );
}
