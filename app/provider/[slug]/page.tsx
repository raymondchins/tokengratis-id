import { getAllOffers, getOfferBySlug } from "@/lib/data";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  IndonesiaBadge,
  TristateBadge,
  CategoryTag,
  OfferTypeTag,
  SyncedLabel,
} from "@/components/directory/Badges";
import type { Offer } from "@/lib/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function val(v: string | null): string {
  return v ?? "Unknown";
}

// ─── static params ──────────────────────────────────────────────────────────

export async function generateStaticParams() {
  return getAllOffers().map((o) => ({ slug: o.slug }));
}

// ─── metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const offer = getOfferBySlug(slug);
  if (!offer) return {};
  return {
    title: `${offer.provider} — tokengratis.id`,
    description: `Detail free AI credits / free tier dari ${offer.provider}. Aggregator, bukan verifier.`,
  };
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const offer: Offer | undefined = getOfferBySlug(slug);
  if (!offer) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-16 sm:py-24">
      {/* ── back nav ── */}
      <Link
        href="/directory"
        className="group mb-10 inline-flex items-center gap-1.5 text-sm text-mute transition-colors hover:text-fog"
      >
        <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
          ←
        </span>
        Kembali ke direktori
      </Link>

      {/* ── provider header ── */}
      <header className="flex items-start gap-4">
        {offer.logo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={offer.logo}
            alt={`${offer.provider} logo`}
            width={48}
            height={48}
            className="mt-1 h-12 w-12 shrink-0 rounded-xl border border-ink-line object-contain p-1"
          />
        ) : (
          <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-ink-line bg-ink-soft text-lg font-semibold text-ember">
            {offer.provider.charAt(0)}
          </div>
        )}

        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fog sm:text-3xl">
            {offer.provider}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CategoryTag category={offer.category} />
            <OfferTypeTag type={offer.offerType} />
          </div>
        </div>
      </header>

      {/* ── action buttons ── */}
      {(offer.signupUrl || offer.docsUrl) && (
        <div className="mt-8 flex flex-wrap gap-3">
          {offer.signupUrl && (
            <a
              href={offer.signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
            >
              Daftar
              <span aria-hidden>↗</span>
            </a>
          )}
          {offer.docsUrl && (
            <a
              href={offer.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-ink-line bg-ink-soft px-5 py-2.5 text-sm font-semibold text-fog transition-colors hover:border-ember hover:text-ember"
            >
              Dokumentasi
              <span aria-hidden>↗</span>
            </a>
          )}
        </div>
      )}

      {/* ── detail fields ── */}
      <section className="mt-10 overflow-hidden rounded-2xl border border-ink-line">
        <div className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-mute">
          Detail offer
        </div>
        <dl className="divide-y divide-ink-line">
          <Row label="Jumlah credit / kuota">
            <span className={offer.freeQuota ? "text-fog" : "text-mute"}>
              {val(offer.freeQuota)}
            </span>
          </Row>

          <Row label="Rate limit">
            <span className={offer.rateLimit ? "text-fog" : "text-mute"}>
              {val(offer.rateLimit)}
            </span>
          </Row>

          <Row label="Butuh kartu kredit">
            <TristateBadge label="Butuh CC" value={offer.requiresCreditCard} />
          </Row>

          <Row label="Butuh verifikasi HP">
            <TristateBadge label="Verif HP" value={offer.requiresPhoneVerification} />
          </Row>

          <Row label="API tersedia">
            <TristateBadge label="API" value={offer.apiAvailable} />
          </Row>

          <Row label="Akses dari Indonesia">
            <IndonesiaBadge status={offer.indonesiaAccess} />
          </Row>

          <Row label="Kadaluarsa">
            <span className={offer.expiry ? "text-fog" : "text-mute"}>
              {val(offer.expiry)}
            </span>
          </Row>
        </dl>
      </section>

      {/* ── source / attribution block ── */}
      <section className="mt-8 rounded-2xl border border-ink-line bg-ink-soft px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mute">
              Sumber data
            </p>
            <p className="mt-1 text-xs leading-relaxed text-mute">
              Data ini di-sync dari sumber berikut. Kami aggregator — bukan verifier.
            </p>
          </div>
          <SyncedLabel sources={offer.sources} syncedAt={offer.syncedAt} />
        </div>

        {offer.sources.length > 0 && (
          <ul className="mt-5 space-y-4">
            {offer.sources.map((src, i) => (
              <li key={i} className="space-y-2">
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-ember transition-opacity hover:opacity-80"
                >
                  {src.name}
                  <span aria-hidden className="text-xs">
                    ↗
                  </span>
                </a>
                {src.quote && (
                  <blockquote className="border-l-2 border-ink-line pl-3 text-xs leading-relaxed text-mute italic">
                    &ldquo;{src.quote}&rdquo;
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── footer nudge ── */}
      <footer className="mt-auto pt-16 text-xs text-mute">
        <p>
          Data ini di-aggregate otomatis dari sumber komunitas. Kalau ada yang
          ga akurat,{" "}
          <a
            href="https://github.com/cheahjs/free-llm-api-resources"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ember hover:opacity-80"
          >
            perbaiki di sumbernya
          </a>{" "}
          — kita ikut sync tiap malam.
        </p>
      </footer>
    </main>
  );
}

// ─── Row sub-component ───────────────────────────────────────────────────────

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(10rem,1fr)_2fr] items-center gap-4 px-5 py-3.5 sm:grid-cols-[14rem_1fr]">
      <dt className="text-sm text-mute">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
