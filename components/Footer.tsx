import { Link } from "next-view-transitions";
import { getAllProviders, getSources } from "@/lib/data";
import { getOpenSourceSources } from "@/lib/opensource-data";
import { MODALITY_ORDER, modalityLabel } from "@/components/directory/Badges";
import type { Modality } from "@/lib/types";
import SocialIcons from "@/components/SocialIcons";

/**
 * Facet links surfaced here so crawlers reach /gratis/<modality> from every
 * page. MUST mirror the identical eligibility check in
 * app/gratis/[modality]/page.tsx (generateStaticParams) and app/sitemap.ts:
 * modality needs >=3 providers (provider-level `p.modalities`) AND isn't
 * "text" (24/24 providers — would just duplicate the homepage directory).
 * Kept as a separate copy since route/component files can't import from one
 * another here.
 */
const MIN_FACET_PROVIDERS = 3;
const EXCLUDED_FACETS: Modality[] = ["text"];

function eligibleFacetModalities(providers: ReturnType<typeof getAllProviders>): Modality[] {
  const counts = new Map<Modality, number>();
  for (const p of providers) {
    for (const m of p.modalities) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return MODALITY_ORDER.filter(
    (m) => (counts.get(m) ?? 0) >= MIN_FACET_PROVIDERS && !EXCLUDED_FACETS.includes(m),
  );
}

/**
 * Footer global (mount di app/layout.tsx → muncul di semua page).
 * Atribusi sumber otomatis dari getSources() — ikut berapapun sumber ke-wire.
 * id="sumber" = target anchor nav "Sumber".
 */
export default function Footer() {
  const sources = getSources();
  const osSources = getOpenSourceSources();
  const facetModalities = eligibleFacetModalities(getAllProviders());

  return (
    <footer
      id="sumber"
      className="mt-16 border-t border-ink-line scroll-mt-20"
    >
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-mute sm:px-6">
        <p className="max-w-2xl">
          Sumber data API LLM:{" "}
          {sources.map((s, i) => (
            <span key={s.name}>
              {i > 0 && (i === sources.length - 1 ? " & " : ", ")}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-ink-line underline-offset-2 hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
              >
                {s.name}
              </a>
            </span>
          ))}
          . Di-sync &amp; di-aggregate otomatis dari tiap sumber. Kita aggregator
          — bukan verifier, bukan pemilik datanya. Tiap provider nampilin di-sync
          dari sumber mana aja.
        </p>
        <p className="mt-3 max-w-2xl">
          Sumber direktori open source:{" "}
          {osSources.map((s, i) => (
            <span key={s.name}>
              {i > 0 && (i === osSources.length - 1 ? " & " : ", ")}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-ink-line underline-offset-2 hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
              >
                {s.name}
              </a>
            </span>
          ))}
          . Kurasi proyek dari komunitas, metadata di-sync live dari GitHub.
        </p>
        {facetModalities.length > 0 && (
          <p className="mt-3 max-w-2xl">
            Jelajah:{" "}
            {facetModalities.map((m, i) => (
              <span key={m}>
                <Link
                  href={`/gratis/${m}`}
                  className="inline-block py-1.5 underline decoration-ink-line underline-offset-2 hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
                >
                  API {modalityLabel(m)} Gratis
                </Link>
                {i < facetModalities.length - 1 && <span> · </span>}
              </span>
            ))}
          </p>
        )}
        <p className="mt-3 max-w-2xl">
          Alat:{" "}
          {[
            { href: "/pilih", label: "Pilih model" },
            { href: "/fallback", label: "Rantai fallback" },
            { href: "/modal-gratis", label: "Modal gratis" },
            { href: "/changelog", label: "Perubahan data" },
            { href: "/#cara-kerja", label: "Cara kerja" },
          ].map((l, i, arr) => (
            <span key={l.href}>
              <Link
                href={l.href}
                className="inline-block py-1.5 underline decoration-ink-line underline-offset-2 hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
              >
                {l.label}
              </Link>
              {i < arr.length - 1 && <span> · </span>}
            </span>
          ))}
        </p>
        <p className="mt-3 max-w-2xl">
          Buat mesin:{" "}
          {[
            { href: "/feed.xml", label: "RSS perubahan" },
            { href: "/api/providers", label: "API provider (JSON)" },
            { href: "/api/models", label: "API model (JSON)" },
            { href: "/llms.txt", label: "llms.txt" },
          ].map((l, i, arr) => (
            <span key={l.href}>
              <a
                href={l.href}
                className="inline-block py-1.5 underline decoration-ink-line underline-offset-2 hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
              >
                {l.label}
              </a>
              {i < arr.length - 1 && <span> · </span>}
            </span>
          ))}
          . Bebas dipakai, atribusi ke sumber aslinya tetap wajib.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-mute">
            <span className="font-medium text-fog">tokengratis.id</span> — karena
            raymond boros token.
          </p>
          <div className="[&_a]:p-3.5 [&_a]:-m-3.5">
            <SocialIcons />
          </div>
        </div>
      </div>
    </footer>
  );
}
