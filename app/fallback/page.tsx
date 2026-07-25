import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { getAllProviders } from "@/lib/data";
import { getEligibleProviders, getExcludedProviders } from "@/lib/fallback";
import FallbackClient from "./FallbackClient";

export const metadata: Metadata = {
  title: "Generator Rantai Fallback — tokengratis.id",
  description:
    "Susun 2–4 provider free tier berurutan, otomatis lompat kalau satu kena rate limit. Generate config Vercel AI SDK, LiteLLM, TypeScript, atau .env — siap pakai.",
  alternates: { canonical: "https://tokengratis.id/fallback" },
  openGraph: {
    title: "Generator Rantai Fallback — tokengratis.id",
    description:
      "Susun 2–4 provider free tier berurutan, otomatis lompat kalau satu kena rate limit. Generate config siap pakai.",
    url: "https://tokengratis.id/fallback",
    siteName: "tokengratis.id",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Generator Rantai Fallback — tokengratis.id",
    description:
      "Susun 2–4 provider free tier berurutan, otomatis lompat kalau satu kena rate limit. Generate config siap pakai.",
    creator: "@raymondchins",
  },
};

export default function FallbackPage() {
  const providers = getAllProviders();
  const eligible = getEligibleProviders(providers);
  const excluded = getExcludedProviders(providers);

  return (
    <div className="min-h-dvh pb-24">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-4xl px-4 pt-16 sm:px-6 sm:pt-24">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-2xl text-center">
          <h1 className="font-serif text-4xl font-medium leading-[1.04] tracking-tight text-fog sm:text-5xl">
            Bikin rantai fallback
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-mute sm:text-lg">
            Keluhan paling umum soal free tier LLM:{" "}
            <span className="font-medium text-fog">
              satu provider abis kuota cuma dari beberapa prompt doang
            </span>{" "}
            — apalagi kalau di-integrasi ke IDE. Jawabannya bukan "pakai provider
            ini", tapi{" "}
            <span className="font-medium text-fog">
              susun beberapa provider berurutan
            </span>
            , otomatis lompat ke yang berikutnya begitu satu kena limit.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-mute">
            Pilih 2–4 provider di bawah, urut prioritasnya, terus generate config
            siap-pakai — Vercel AI SDK, LiteLLM, TypeScript polos, atau{" "}
            <code className="rounded-[4px] bg-ink-line/60 px-1.5 py-0.5 text-[13px] text-fog">
              .env
            </code>
            .
          </p>

          <div className="mx-auto mt-6 flex max-w-xl items-start gap-2.5 rounded-[8px] border border-ink-line bg-ink-soft px-4 py-3 text-left text-xs leading-relaxed text-mute">
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-fog">
              ⚠
            </span>
            <p>
              <span className="font-medium text-fog">Catatan jujur:</span> rate
              limit itu per akun, bukan per rantai. Nyusun beberapa provider{" "}
              <span className="font-medium text-fog">ngurangin downtime</span>{" "}
              — bukan ngaliin kuota jadi lebih besar dari yang dikasih
              masing-masing provider.
            </p>
          </div>
        </section>

        {/* ── Generator ── */}
        <section className="mt-12 sm:mt-16">
          <h2 className="sr-only">Generator rantai fallback</h2>
          <FallbackClient providers={eligible} />
        </section>

        {/* ── Provider yang ga bisa dipilih ── */}
        {excluded.length > 0 && (
          <section className="mt-10">
            <p className="text-balance text-center text-[11px] leading-relaxed text-mute">
              {excluded.length} provider di direktori belum muncul di generator ini
              (
              {excluded.map((p, i) => (
                <span key={p.slug}>
                  {p.name}
                  {i < excluded.length - 1 && ", "}
                </span>
              ))}
              ) — sumbernya belum nyediain base URL API secara terstruktur, jadi
              config-nya ga bisa di-generate tanpa nebak.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
