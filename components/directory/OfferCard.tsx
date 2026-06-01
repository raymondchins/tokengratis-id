import Link from "next/link";
import type { Offer } from "@/lib/types";
import {
  CategoryTag,
  IndonesiaBadge,
  OfferTypeTag,
  SyncedLabel,
  TristateBadge,
} from "./Badges";

export default function OfferCard({ offer }: { offer: Offer }) {
  return (
    <Link
      href={`/provider/${offer.slug}`}
      className="group block rounded-xl border border-ink-line bg-ink-soft p-5 transition-colors hover:border-ember/50 hover:bg-ink-soft"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {offer.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={offer.logo}
              alt={`${offer.provider} logo`}
              className="h-8 w-8 shrink-0 rounded object-contain"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-ink border border-ink-line text-xs font-bold text-mute uppercase">
              {offer.provider.slice(0, 2)}
            </div>
          )}
          <span className="truncate font-semibold text-fog group-hover:text-ember-soft transition-colors">
            {offer.provider}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <CategoryTag category={offer.category} />
          <OfferTypeTag type={offer.offerType} />
        </div>
      </div>

      {/* Free quota */}
      <div className="mt-4">
        <p className="text-xs text-mute">Kuota gratis</p>
        <p className="mt-0.5 text-sm font-medium text-fog">
          {offer.freeQuota ?? <span className="text-mute italic">Unknown</span>}
        </p>
      </div>

      {/* Priority signals */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        <IndonesiaBadge status={offer.indonesiaAccess} />
        <TristateBadge label="Butuh CC" value={offer.requiresCreditCard} />
        <TristateBadge label="Verif HP" value={offer.requiresPhoneVerification} />
      </div>

      {/* Synced attribution */}
      <div className="mt-4 border-t border-ink-line pt-3">
        <SyncedLabel sources={offer.sources} syncedAt={offer.syncedAt} />
      </div>
    </Link>
  );
}
