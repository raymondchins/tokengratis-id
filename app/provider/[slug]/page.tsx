import { getAllProviders, getProviderBySlug } from "@/lib/data";
import { notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ProviderLogo from "@/components/ProviderLogo";
import { CategoryTag, ModalityTags, SourceLine } from "@/components/directory/Badges";
import type { Provider } from "@/lib/types";

export async function generateStaticParams() {
  return getAllProviders().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getProviderBySlug(slug);
  if (!p) return {};
  return {
    title: `${p.name} — tokengratis.id`,
    description: `Free tier / free credits API dari ${p.name}. ${p.modelCount} model, sampai ${p.maxContext ?? "?"} context. Aggregator, bukan verifier.`,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p: Provider | undefined = getProviderBySlug(slug);
  if (!p) notFound();

  return (
    <div className="min-h-dvh pb-24">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pt-12">
        {/* back */}
        <Link
          href="/#direktori"
          className="group mb-10 inline-flex items-center gap-1.5 text-sm text-mute transition-colors hover:text-fog"
        >
          <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
            ←
          </span>
          Kembali ke direktori
        </Link>

        {/* header */}
        <header className="flex items-start gap-4">
          <ProviderLogo
            logo={p.logo}
            flag={p.flag}
            name={p.name}
            className="mt-1 h-12 w-12"
          />
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-fog sm:text-3xl">
              {p.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CategoryTag category={p.category} />
              <span className="text-xs text-mute">
                {p.modelCount} model · context maks {p.maxContext ?? "—"}
              </span>
            </div>
            <div className="mt-3">
              <ModalityTags modalities={p.modalities} />
            </div>
          </div>
        </header>

        {/* actions */}
        {(p.url || p.baseUrl) && (
          <div className="mt-8 space-y-3">
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-ember px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ember-soft"
              >
                Dapatkan API key
                <span aria-hidden>↗</span>
              </a>
            )}
            {p.baseUrl && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
                <span className="font-medium">Base URL</span>
                <code className="rounded-md border border-ink-line bg-ink-soft px-2 py-1 font-mono text-[12px] text-fog">
                  {p.baseUrl}
                </code>
              </div>
            )}
          </div>
        )}

        {/* description (apa adanya dari sumber) */}
        {p.description && (
          <section className="mt-8 rounded-2xl border border-ink-line bg-ink-soft px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mute">
              Catatan dari sumber
            </p>
            <p className="mt-2 text-sm leading-relaxed text-fog">{p.description}</p>
          </section>
        )}

        {/* models */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-ink-line">
          <div className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-mute">
            Model tersedia ({p.modelCount})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-t border-ink-line text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-mute">
                  <th className="px-5 py-2.5 font-semibold">Model</th>
                  <th className="px-3 py-2.5 font-semibold">Modality</th>
                  <th className="px-3 py-2.5 font-semibold">Context</th>
                  <th className="px-3 py-2.5 font-semibold">Output</th>
                  <th className="px-5 py-2.5 font-semibold">Rate limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {p.models.map((m) => (
                  <tr key={m.id} className="align-top">
                    <td className="px-5 py-3">
                      <div className="font-medium text-fog">{m.name}</div>
                      <div className="font-mono text-[11px] text-mute">{m.id}</div>
                    </td>
                    <td className="px-3 py-3 text-mute">{m.modality}</td>
                    <td className="px-3 py-3 text-fog">{m.context ?? "—"}</td>
                    <td className="px-3 py-3 text-mute">{m.maxOutput ?? "—"}</td>
                    <td className="px-5 py-3 text-mute">{m.rateLimit ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* source */}
        <section className="mt-8 rounded-2xl border border-ink-line bg-ink-soft px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mute">
                Sumber data
              </p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-mute">
                Data ini di-sync apa adanya dari sumber di bawah. Kami aggregator —
                bukan verifier, bukan pemilik datanya.
              </p>
            </div>
            <SourceLine source={p.source} syncedAt={p.syncedAt} />
          </div>
        </section>

        {/* footer */}
        <footer className="mt-16 text-xs text-mute">
          <p>
            Data di-aggregate otomatis dari sumber komunitas. Kalau ada yang ga
            akurat,{" "}
            <a
              href={p.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-ink-line underline-offset-2 hover:text-fog"
            >
              perbaiki di sumbernya
            </a>{" "}
            — kita ikut sync ulang.
          </p>
        </footer>
      </main>
    </div>
  );
}
