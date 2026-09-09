import { getAllProviders, getProviderBySlug } from "@/lib/data";
import { getModelClusters } from "@/lib/model-clusters";
import { notFound } from "next/navigation";
import { Link } from "next-view-transitions";
import Navbar from "@/components/Navbar";
import DetailBreadcrumb from "@/components/nav/DetailBreadcrumb";
import ProviderLogo from "@/components/ProviderLogo";
import { SourceLine, modalityLabel } from "@/components/directory/Badges";
import ModelsTable from "@/components/directory/ModelsTable";
import ProviderFaq from "@/components/directory/ProviderFaq";
import SetupPanel from "@/components/setup/SetupPanel";
import { NEED_LABELS, NEED_ORDER } from "@/lib/directory-state";
import { providerSnippet } from "@/lib/seo";
import { fmtDate } from "@/lib/date";

export async function generateStaticParams() {
  return getAllProviders().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProviderBySlug(slug);
  if (!p) return {};
  const { title, description } = providerSnippet({
    name: p.name, modelCount: p.modelCount, maxContext: p.maxContext,
    modalityText: p.modalities.map(modalityLabel).join("/"),
    syncedLabel: p.syncedAt ? fmtDate(p.syncedAt) : null,
  });
  return {
    title, description,
    alternates: { canonical: `https://tokengratis.id/provider/${p.slug}` },
    openGraph: { title, description, url: `https://tokengratis.id/provider/${p.slug}`, siteName: "tokengratis.id", locale: "id_ID", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProviderBySlug(slug);
  if (!p) notFound();
  const crossProvider = getModelClusters().flatMap((cluster) => {
    const mine = cluster.entries.find((entry) => entry.provider.slug === p.slug);
    return mine ? [{ slug: cluster.slug, name: mine.model.name, providerCount: new Set(cluster.entries.map((entry) => entry.provider.slug)).size }] : [];
  });
  const providerUrl = p.url ?? (p.domain ? `https://${p.domain}` : undefined);
  const structuredData = [
    {
      "@context": "https://schema.org", "@type": "SoftwareApplication", name: p.name,
      applicationCategory: "DeveloperApplication", operatingSystem: "Web", inLanguage: "id",
      description: p.description ?? `Free tier API dari ${p.name} — ${p.modelCount} model.`,
      ...(providerUrl ? { url: providerUrl } : {}),
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Direktori", item: "https://tokengratis.id" },
        { "@type": "ListItem", position: 2, name: p.name, item: `https://tokengratis.id/provider/${p.slug}` },
      ],
    },
    {
      "@context": "https://schema.org", "@type": "CollectionPage", name: `Model gratis ${p.name}`,
      url: `https://tokengratis.id/provider/${p.slug}`, inLanguage: "id",
      mainEntity: { "@type": "ItemList", numberOfItems: p.models.length, itemListElement: p.models.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: m.name })) },
    },
  ];

  return (
    <div className="min-h-dvh pb-16">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-6xl px-5 pt-6 sm:px-8 sm:pt-10">
        <DetailBreadcrumb current={p.name} />
        <header className="flex items-start gap-4 border-b border-ink-line pb-7 sm:gap-5">
          <ProviderLogo logo={p.logo} flag={p.flag} name={p.name} className="h-14 w-14 sm:h-16 sm:w-16" priority />
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">{p.name}</h1>
            <p className="mt-2 text-sm text-mute">{p.modelCount} model tercatat di sumber komunitas</p>
            <ul aria-label="Kemampuan menurut sumber" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-mute">
              {NEED_ORDER.filter((m) => p.modalities.includes(m)).map((m) => <li key={m}>{NEED_LABELS[m]}</li>)}
            </ul>
          </div>
        </header>

        <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
          <div className="min-w-0 space-y-8">
            <section aria-labelledby="start-heading" className="rounded-2xl border border-ink-line bg-ink-soft p-5 sm:p-6">
              <h2 id="start-heading" className="font-sans text-xl font-semibold tracking-tight">Mulai pakai {p.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-mute">Token digunakan di layanan penyedia. Ikuti syarat dan batas paket gratis di sana.</p>
              {p.freeLimit && <p className="mt-4 text-base font-semibold text-grass">Batas gratis dari sumber: {p.freeLimit}</p>}
              {p.description && <div className="mt-4 border-t border-ink-line pt-4"><h3 className="font-sans text-sm font-semibold">Catatan sebelum mulai</h3><p className="mt-2 text-sm leading-relaxed text-mute [overflow-wrap:anywhere]">{p.description}</p></div>}
              {p.url ? <>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ember px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ember-soft sm:w-auto">Mulai di {p.name} <span aria-hidden="true">↗</span><span className="sr-only"> (tab baru)</span></a>
                <p className="mt-2 text-xs text-mute">Membuka halaman resmi penyedia.</p>
              </> : <>
                <p className="mt-4 text-sm leading-relaxed text-mute">Link pendaftaran belum dicantumkan di data. Buka sumbernya untuk mencari petunjuk akses.</p>
                {p.sources[0] && <a href={p.sources[0].url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-ember px-5 text-sm font-semibold text-white hover:bg-ember-soft">Lihat petunjuk di sumber <span aria-hidden="true">↗</span></a>}
              </>}
            </section>

            <section id="langkah-pakai" className="scroll-mt-32">
              <h2 className="font-sans text-xl font-semibold tracking-tight">Setelah membuka penyedia</h2>
              <p className="mt-2 text-xs leading-relaxed text-mute">Alur umum; langkah dan persyaratan tiap layanan bisa berbeda.</p>
              <ol className="mt-4 space-y-4 text-sm leading-relaxed">
                <li><span className="font-semibold">1. Cek paket gratisnya.</span><br /><span className="text-mute">Lihat batas pemakaian dan syarat akun. Jika diminta, daftar atau masuk.</span></li>
                <li><span className="font-semibold">2. Buat API key jika diperlukan.</span><br /><span className="text-mute">Ikuti petunjuk di dashboard penyedia. Simpan key untuk kamu sendiri.</span></li>
                <li><span className="font-semibold">3. Pilih model dan hubungkan.</span><br /><span className="text-mute">Gunakan model gratis yang tersedia di aplikasi atau proyek yang mendukung penyedia ini.</span></li>
              </ol>
            </section>

            <section id="model" className="scroll-mt-32">
              <h2 className="mb-3 font-sans text-xl font-semibold tracking-tight">Model & batas pemakaian</h2>
              <p className="mb-4 text-sm leading-relaxed text-mute">Periksa model yang ingin dipakai. Batas dan kemampuan bisa berbeda untuk setiap model.</p>
              <ModelsTable models={p.models} more={p.moreModels} sourceUrl={p.sources[0]?.url} />
            </section>

            <details id="setup" className="group scroll-mt-32 rounded-2xl border border-ink-line bg-ink-soft p-5 sm:p-6">
              <summary className="min-h-11 cursor-pointer text-base font-semibold">Pasang di proyekmu: contoh kode</summary>
              <p className="mb-4 mt-2 text-sm leading-relaxed text-mute">Sudah punya akses? Pilih model dan bahasa pemrograman, lalu salin contohnya.</p>
              <SetupPanel provider={p} />
            </details>
            <ProviderFaq provider={p} />

            {crossProvider.length > 0 && <details className="border-t border-ink-line pt-4">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold">Cari model yang sama di penyedia lain</summary>
              <p className="mt-2 text-xs leading-relaxed text-mute">Nama model sama menurut sumber; versi atau kuantisasi bisa berbeda.</p>
              <ul className="mt-3 divide-y divide-ink-line">{crossProvider.map((model) => <li key={model.slug}><Link href={`/model/${model.slug}`} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:underline underline-offset-4"><span className="min-w-0 break-words">{model.name}</span><span className="shrink-0 text-xs text-mute">{model.providerCount} penyedia →</span></Link></li>)}</ul>
            </details>}
          </div>

          <aside className="min-w-0 space-y-6 lg:sticky lg:top-24">
            <nav aria-label="Di halaman penyedia ini" className="border-b border-ink-line pb-5">
              <p className="mb-2 text-sm font-semibold">Yang kamu butuhkan</p>
              <a href="#langkah-pakai" className="flex min-h-11 items-center justify-between text-sm text-mute hover:text-fog">Langkah mulai <span aria-hidden="true">↓</span></a>
              <a href="#model" className="flex min-h-11 items-center justify-between text-sm text-mute hover:text-fog">Model & batas pemakaian <span aria-hidden="true">↓</span></a>
              <a href="#setup" className="flex min-h-11 items-center justify-between text-sm text-mute hover:text-fog">Contoh kode <span aria-hidden="true">↓</span></a>
            </nav>
            <section id="sumber-provider" className="scroll-mt-32 [overflow-wrap:anywhere]">
              <h2 className="font-sans text-sm font-semibold">Data ini dari mana?</h2>
              <div className="mt-3"><SourceLine sources={p.sources} sourceUpdatedAt={p.sourceUpdatedAt} /></div>
              <p className="mt-3 text-xs leading-relaxed text-mute">Kami mengumpulkan data dari sumber komunitas. Ketersediaan dan syarat terbaru mengikuti penyedia.</p>
            </section>
            {(p.baseUrl || p.maxContext || p.domain) && <details className="border-t border-ink-line pt-3">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold">Detail teknis penyedia</summary>
              <dl className="mt-3 space-y-4 text-xs">
                {p.baseUrl && <div><dt className="mb-1 text-mute">Base URL</dt><dd><code className="block overflow-x-auto rounded-lg border border-ink-line bg-ink-soft p-3 font-mono">{p.baseUrl}</code></dd></div>}
                {p.maxContext && <div><dt className="text-mute">Context maksimum dari seluruh model</dt><dd className="mt-1 font-medium">{p.maxContext}</dd></div>}
                {p.domain && <div><dt className="text-mute">Domain</dt><dd className="mt-1"><a href={`https://${p.domain}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{p.domain}</a></dd></div>}
              </dl>
            </details>}
            <Link href="/#direktori" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold hover:underline underline-offset-4">Cari penyedia lainnya <span aria-hidden="true">→</span></Link>
          </aside>
        </div>
        {structuredData.map((data, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />)}
      </main>
    </div>
  );
}
