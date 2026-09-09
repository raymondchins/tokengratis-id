import { Link } from "next-view-transitions";
import type { ProviderListItem } from "@/lib/types";
import ProviderLogo from "@/components/ProviderLogo";
import { NEED_LABELS, NEED_ORDER } from "@/lib/directory-state";
import { SourceLine } from "./Badges";

type CardProvider = Pick<ProviderListItem, "slug" | "name" | "url" | "logo" | "flag" | "modelCount" | "modalities" | "freeLimit" | "description" | "sources">;

export default function ProviderCard({ provider: p, priority = false, modelLabel }: {
  provider: CardProvider;
  priority?: boolean;
  modelLabel?: string;
}) {
  const href = `/provider/${p.slug}`;
  return (
    <article className="flex min-w-0 flex-col">
      <div className="flex flex-1 flex-col rounded-2xl border border-ink-line bg-ink-soft p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ProviderLogo logo={p.logo} flag={p.flag} name={p.name} className="h-12 w-12" priority={priority} />
          <div className="min-w-0 flex-1">
            <h3 className="font-sans text-lg font-semibold leading-snug tracking-tight">
              <Link href={href} className="inline-flex min-h-11 items-center rounded-sm hover:underline underline-offset-4">{p.name}</Link>
            </h3>
            <p className="text-xs text-mute">{modelLabel ?? `${p.modelCount} model di direktori`}</p>
          </div>
        </div>

        <p className="mt-5 text-sm font-semibold text-grass">
          {p.freeLimit ?? "Model gratis tercatat di sumber"}
        </p>
        {p.description && <p className="mt-2 text-sm leading-relaxed text-mute [overflow-wrap:anywhere]">{p.description}</p>}

        <ul aria-label="Kemampuan menurut sumber" className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-mute">
          {NEED_ORDER.filter((m) => p.modalities.includes(m)).map((m) => <li key={m}>{NEED_LABELS[m]}</li>)}
        </ul>
        <div className="mt-auto pt-5 [overflow-wrap:anywhere]">
          <SourceLine sources={p.sources.slice(0, 1)} />
          {p.sources.length > 1 && <Link href={`${href}#sumber-provider`} className="ml-1 text-xs text-mute underline underline-offset-2">+{p.sources.length - 1} sumber</Link>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 pt-2 pb-1">
        <Link href={href} aria-label={`Cara pakai ${p.name}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-fog transition-colors hover:bg-ink-sel">
          Cara pakai <span aria-hidden="true">→</span>
        </Link>
        {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Buka ${p.name} (tab baru)`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-mute transition-colors hover:bg-ink-sel hover:text-fog">
          Buka penyedia <span aria-hidden="true">↗</span>
        </a>}
      </div>
    </article>
  );
}
