import { Link } from "next-view-transitions";
import { getAllProviders, getSources } from "@/lib/data";
import { getOpenSourceSources } from "@/lib/opensource-data";
import { MODALITY_ORDER, modalityLabel } from "@/components/directory/Badges";
import type { Modality } from "@/lib/types";
import SocialIcons from "@/components/SocialIcons";

// Match the facet eligibility in app/gratis/[modality]/page.tsx and sitemap.ts.
const MIN_FACET_PROVIDERS = 3;
const EXCLUDED_FACETS: Modality[] = ["text"];
const LINK_STYLE = "inline-flex min-h-11 items-center rounded-sm underline decoration-ink-line underline-offset-4 hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70";

function eligibleFacetModalities(providers: ReturnType<typeof getAllProviders>): Modality[] {
  const counts = new Map<Modality, number>();
  for (const provider of providers) {
    for (const modality of provider.modalities) counts.set(modality, (counts.get(modality) ?? 0) + 1);
  }
  return MODALITY_ORDER.filter(
    (modality) => (counts.get(modality) ?? 0) >= MIN_FACET_PROVIDERS && !EXCLUDED_FACETS.includes(modality),
  );
}

export default function Footer() {
  const sources = getSources();
  const osSources = getOpenSourceSources();
  const facetModalities = eligibleFacetModalities(getAllProviders());

  return (
    <footer id="sumber" className="mt-16 scroll-mt-32 border-t border-ink-line">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-mute sm:px-6">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:gap-12">
          <div className="max-w-xl">
            <p className="font-medium text-fog">Data terbuka, sumber jelas.</p>
            <p className="mt-2 leading-relaxed">
              Kami mengumpulkan info API gratis dari komunitas. Kuota dan syarat mengikuti masing-masing provider; sumber dan tanggal sync ada di setiap detail.
            </p>
          </div>
          <Link href="/#direktori" className={`${LINK_STYLE} self-start whitespace-nowrap font-medium text-fog`}>Cari token gratis</Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5">
          <span>Sumber API LLM:</span>
          {sources.map((source) => (
            <a key={source.name} href={source.url} target="_blank" rel="noopener noreferrer" className={LINK_STYLE}>
              {source.name}
            </a>
          ))}
        </div>

        <details className="mt-5 border-t border-ink-line pt-2">
          <summary className="min-h-11 cursor-pointer content-center rounded-sm font-medium text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70">
            Jelajah, alat, dan sumber lainnya
          </summary>
          <div className="grid gap-x-10 gap-y-5 pb-5 pt-3 md:grid-cols-2">
            <div>
              <p className="font-medium text-fog">Jelajah &amp; alat</p>
              <div className="mt-1 flex flex-wrap gap-x-5">
                {[
                  { href: "/pilih", label: "Pilih model" },
                  { href: "/fallback", label: "Rantai fallback" },
                  { href: "/modal-gratis", label: "Modal gratis" },
                  { href: "/opensource", label: "Open source" },
                  { href: "/changelog", label: "Perubahan data" },
                  { href: "/#cara-kerja", label: "Cara pakai" },
                ].map((link) => <Link key={link.href} href={link.href} className={LINK_STYLE}>{link.label}</Link>)}
                {facetModalities.map((modality) => <Link key={modality} href={`/gratis/${modality}`} className={LINK_STYLE}>API {modalityLabel(modality)} Gratis</Link>)}
              </div>
            </div>
            <div>
              <p className="font-medium text-fog">Sumber direktori open source</p>
              <div className="mt-1 flex flex-wrap gap-x-5">
                {osSources.map((source) => <a key={source.name} href={source.url} target="_blank" rel="noopener noreferrer" className={LINK_STYLE}>{source.name}</a>)}
              </div>
              <p className="mt-1 leading-relaxed">Kurasi proyek dari komunitas, metadata di-sync dari GitHub.</p>
            </div>
            <div className="md:col-span-2">
              <p className="font-medium text-fog">Data untuk developer</p>
              <div className="mt-1 flex flex-wrap gap-x-5">
                {[
                  { href: "/feed.xml", label: "RSS perubahan" },
                  { href: "/api/providers", label: "API provider (JSON)" },
                  { href: "/api/models", label: "API model (JSON)" },
                  { href: "/llms.txt", label: "llms.txt" },
                ].map((link) => <a key={link.href} href={link.href} className={LINK_STYLE}>{link.label}</a>)}
              </div>
              <p className="mt-1 leading-relaxed">Bebas dipakai, atribusi ke sumber aslinya tetap wajib.</p>
            </div>
          </div>
        </details>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-6 border-t border-ink-line pt-6">
          <div className="text-xs">
            <p><span className="font-medium text-fog">tokengratis.id</span> — karena raymond boros token.</p>
            <p className="mt-2">Suka ngulik AI? Kumpul di <a href="https://genesis.ceo" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-fog">genesis.ceo</a>.</p>
          </div>
          <div className="px-3.5 py-3.5 [&_a]:-m-3.5 [&_a]:rounded-sm [&_a]:p-3.5 [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-fog/70">
            <SocialIcons />
          </div>
        </div>
      </div>
    </footer>
  );
}
