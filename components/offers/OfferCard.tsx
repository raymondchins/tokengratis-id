import { Link } from "next-view-transitions";
import ProviderLogo from "@/components/ProviderLogo";
import {
  OFFER_CATEGORY_LABEL,
  OFFER_KIND_LABEL,
  type Offer,
} from "@/lib/offer-types";
import { fmtDate } from "@/lib/date";

// ─── Small badges (lokal — beda schema dari Badges.tsx punya direktori LLM) ───

function CategoryBadge({ category }: { category: Offer["category"] }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-[4px] border border-ink-line bg-ink px-2 py-0.5 text-[11px] font-medium text-mute">
      {OFFER_CATEGORY_LABEL[category]}
    </span>
  );
}

function KindBadge({ kind }: { kind: Offer["kind"] }) {
  const isFreeTier = kind === "free_tier";
  return (
    <span
      className={
        isFreeTier
          ? "inline-flex shrink-0 items-center rounded-[4px] border border-grass-line bg-grass-bg px-2 py-0.5 text-[11px] font-semibold text-grass"
          : "inline-flex shrink-0 items-center rounded-[4px] border border-ink-line bg-ink-soft px-2 py-0.5 text-[11px] font-medium text-mute"
      }
    >
      {OFFER_KIND_LABEL[kind]}
    </span>
  );
}

const ID_INDIE_LABEL: Record<Offer["idIndie"], string> = {
  bisa: "Bisa buat indie Indonesia",
  tidak: "Butuh VC atau referral",
  belum_jelas: "Belum jelas",
};

function IdIndieBadge({ idIndie }: { idIndie: Offer["idIndie"] }) {
  const cls =
    idIndie === "bisa"
      ? "border-grass-line bg-grass-bg text-grass"
      : idIndie === "tidak"
        ? "border-ink-line bg-ink text-fog"
        : "border-ink-line bg-ink-soft text-mute italic";
  const icon = idIndie === "bisa" ? "✓" : idIndie === "tidak" ? "→" : "?";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[11.5px] font-medium ${cls}`}
    >
      <span aria-hidden="true">{icon}</span>
      {ID_INDIE_LABEL[idIndie]}
    </span>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────

export default function OfferCard({
  offer,
  priority = false,
}: {
  offer: Offer;
  priority?: boolean;
}) {
  const logo = offer.domain
    ? `https://www.google.com/s2/favicons?sz=128&domain=${offer.domain}`
    : null;
  const primarySource = offer.sources[0];

  return (
    <Link
      href={`/modal-gratis/${offer.slug}`}
      className="group flex h-full flex-col gap-3.5 rounded-[8px] border border-ink-line bg-ink-soft p-5 transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog focus-visible:ring-inset"
    >
      {/* Header: logo + name/vendor + kind */}
      <div className="flex items-start gap-3">
        <ProviderLogo logo={logo} flag={null} name={offer.vendor} className="h-10 w-10" priority={priority} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-fog">{offer.name}</h3>
          <p className="truncate text-[12px] text-mute">{offer.vendor}</p>
        </div>
        <KindBadge kind={offer.kind} />
      </div>

      {/* Category + credit value */}
      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryBadge category={offer.category} />
        {offer.creditValue && (
          <span className="inline-flex items-center rounded-[4px] border border-grape-line bg-grape-bg px-2 py-0.5 text-[11px] font-semibold text-grape">
            Kredit {offer.creditValue}
          </span>
        )}
      </div>

      {/* Description */}
      {offer.description && (
        <p className="line-clamp-2 text-[13px] leading-relaxed text-mute">{offer.description}</p>
      )}

      {/* Limits — top 2-3, apa adanya. Array kosong = section ga dirender sama sekali. */}
      {offer.limits.length > 0 && (
        <ul className="space-y-1 text-[12.5px] leading-snug text-fog">
          {offer.limits.slice(0, 3).map((l) => (
            <li key={l} className="flex gap-1.5">
              <span aria-hidden="true" className="shrink-0 text-mute">·</span>
              <span className="min-w-0">{l}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Traps — nilai utama halaman ini, dibikin visually distinct (bukan cuma teks
          biasa) pakai bg beda + border + ikon ⚠ + label uppercase (bukan stripe
          samping — anti-pattern), tanpa nambah warna baru di globals.css. */}
      {offer.traps.length > 0 && (
        <div className="rounded-[6px] border border-ink-line bg-ink px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mute">
            <span aria-hidden="true">⚠</span> Jebakan
          </p>
          <ul className="mt-1 space-y-1 text-[12.5px] leading-snug text-fog">
            {offer.traps.slice(0, 2).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* idIndie signal */}
      <div>
        <IdIndieBadge idIndie={offer.idIndie} />
      </div>

      {/* Footer: provenance + CTA */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-line pt-3">
        <span className="truncate text-[11px] text-mute">
          {primarySource ? `Dicek ${fmtDate(primarySource.checkedAt)}` : null}
        </span>
        {/* "Lihat", bukan "Detail". Audit nemu 3 label buat SATU aksi di situs
            ini (Lihat / Detail → / Lihat provider ↗) — nol yang dipelajari di
            satu halaman kepake di halaman lain. Panah tetep: aturannya CTA di
            KARTU bawa panah (dia affordance yang berdiri sendiri), CTA di BARIS
            tabel nggak (barisnya sendiri udah nandain bisa diklik). */}
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-fog transition-colors group-hover:text-mute">
          Lihat
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}
