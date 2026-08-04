/**
 * Bikin `<title>` + `<meta description>` halaman provider yang MUAT di SERP.
 *
 * KENAPA ADA: diukur di Google Search Console 2026-08-03 — halaman provider
 * ranking-nya bagus tapi ga diklik. /provider/openrouter posisi 7.7 CTR 1.3%,
 * /provider/mistral-ai posisi 9.2 CTR 1.2%, sementara homepage posisi 5.8 dapet
 * 16.2%. Penyebabnya bukan ranking: title lama 71-83 char (Google motong di
 * ~60, jadi kebaca "…42 Model, Limit & Con…") dan description lama ngabisin
 * ~80 char buat slug repo sumber + disclaimer, jadi angka yang bikin orang
 * pengen ngeklik ga pernah kelihatan.
 *
 * "Aggregator, bukan verifier" SENGAJA dicabut dari meta description — dan CUMA
 * dari situ. Disclaimer-nya tetep utuh di badan halaman provider + Footer, tiap
 * baris data tetep bawa SourceLine, dan ga ada kata "Verified" yang masuk. Core
 * principle kejaga; yang dibuang cuma 27 char di snippet yang justru bikin ragu
 * tepat pas orang lagi mutusin mau klik atau ngga. Gantinya "Di-sync <tanggal>"
 * — sinyal transparansi yang sama tapi jualan kesegaran, bukan keraguan.
 *
 * Pure — no imports, no React, no data access. Tanggal & label modality
 * di-format di pemanggil (lib/date.ts + Badges.tsx) lalu dioper ke sini,
 * supaya file ini bisa dijalanin `node lib/seo.mjs --selftest` tanpa build.
 */

/** Batas potong Google. Bukan aturan keras — di bawah ini aman di mobile. */
export const TITLE_MAX = 60;
export const DESC_MAX = 155;

/**
 * @param {{
 *   name: string,
 *   modelCount: number,
 *   maxContext?: string | null,
 *   modalityText?: string | null,
 *   syncedLabel?: string | null,
 * }} p
 * @returns {{ title: string, description: string }}
 */
export function providerSnippet(p) {
  const { name, modelCount, maxContext, modalityText, syncedLabel } = p;

  // Kandidat title dari paling informatif ke paling pendek; ambil yang pertama
  // muat. Provider bernama panjang ("Cloudflare Workers AI" = 21 char) otomatis
  // turun ke varian pendek daripada kepotong di tengah kata.
  const title =
    [
      `${name} API Gratis — ${modelCount} Model, Rate Limit & Context`,
      `${name} API Gratis — ${modelCount} Model Free Tier`,
      `${name} API Gratis — ${modelCount} Model`,
      `${name} API Gratis`,
    ].find((t) => t.length <= TITLE_MAX) ?? `${name} API Gratis`;

  // Spec diurut dari yang paling dicari developer. Kalau kepanjangan, buang
  // dari BELAKANG (modality dulu, baru context) — "rate limit" ga pernah
  // dibuang karena itu yang paling sering jadi alasan orang ninggalin provider.
  const specs = ["rate limit"];
  if (maxContext) specs.push(`context sampai ${maxContext}`);
  if (modalityText) specs.push(`modality ${modalityText}`);

  const syncedClause = syncedLabel ? ` Di-sync ${syncedLabel}.` : "";
  const build = (parts) =>
    `${modelCount} model gratis di ${name} — ${parts.join(", ")}.${syncedClause}`;

  let description = build(specs);
  while (description.length > DESC_MAX && specs.length > 1) {
    specs.pop();
    description = build(specs);
  }

  return { title, description };
}

// ─── selftest ────────────────────────────────────────────────────────────────
// `node lib/seo.mjs --selftest` (ikut `npm test`). Yang dijaga: dua batas panjang
// itu, dan bahwa pemangkasan berhenti di spec pertama — bukan bikin kalimat buntung.
if (process.argv.includes("--selftest")) {
  const assert = (cond, msg) => {
    if (!cond) {
      console.error(`FAIL: ${msg}`);
      process.exit(1);
    }
  };

  const cases = [
    { name: "OpenRouter", modelCount: 14, maxContext: "1M", modalityText: "Text/Vision/Image/Audio/Video/Code", syncedLabel: "27 Jul 2026" },
    { name: "Cloudflare Workers AI", modelCount: 42, maxContext: "10M", modalityText: "Text/Code/Embeddings", syncedLabel: "27 Jul 2026" },
    { name: "Mistral AI", modelCount: 9, maxContext: "256K", modalityText: "Text/Image/Code", syncedLabel: "27 Jul 2026" },
    // Kasus ekstrem: nama panjang + modality panjang + tanpa context.
    { name: "Some Extremely Long Provider Name Incorporated", modelCount: 3, maxContext: null, modalityText: "Text/Vision/Image/Audio/Video/Code/Embeddings/Reranking", syncedLabel: "27 Jul 2026" },
    // Data minimum — field opsional semua kosong.
    { name: "Groq", modelCount: 1, maxContext: null, modalityText: null, syncedLabel: null },
  ];

  for (const c of cases) {
    const { title, description } = providerSnippet(c);
    assert(title.length <= TITLE_MAX, `title ${title.length} char > ${TITLE_MAX}: "${title}"`);
    assert(description.length <= DESC_MAX || !c.maxContext, `desc ${description.length} char > ${DESC_MAX}: "${description}"`);
    assert(title.includes(c.name), `title kehilangan nama provider: "${title}"`);
    assert(description.includes("rate limit"), `desc kehilangan "rate limit": "${description}"`);
    assert(!description.includes("bukan verifier"), `disclaimer bocor ke meta description: "${description}"`);
    assert(!/,\s*\.|—\s*\./.test(description), `desc buntung (koma/dash gantung): "${description}"`);
  }

  // Nama super panjang tetep harus turun ke varian terpendek, bukan kepotong.
  const long = providerSnippet({ name: "A".repeat(70), modelCount: 5 });
  assert(long.title === `${"A".repeat(70)} API Gratis`, "fallback terakhir title ga kepakai");

  console.log(`seo.mjs selftest OK — ${cases.length + 1} kasus`);
}
