# tokengratis.id — Traffic Roadmap (SEO + GEO + Distribusi)

> Disusun 2026-07-19 dari riset 4-arah (SEO directory-site 2026, GEO/AI-citation,
> pasar+distribusi Indonesia, arsitektur programmatic content). Sumber & bukti
> dicatat per item. Prinsip: semua item HARUS kompatibel dengan constraint proyek
> — static SSG, zero backend, maintenance ~nol, aggregator-bukan-verifier,
> anti-halusinasi.

## Ringkasan strategi

1. **Perbesar permukaan indexable** dari ~26 → ~60 halaman lewat halaman yang
   100% di-generate dari data (facet, cross-provider model, changelog) — BUKAN
   ratusan halaman tipis (per-model tunggal & 276 comparison pairs = jebakan
   scaled-content-abuse Google 2026, di-skip sengaja).
2. **GEO**: yang terbukti ngefek = provenance level-pasase + IndexNow→Bing
   (feeds Copilot & ChatGPT Search). Yang TIDAK terbukti = llms.txt (studi log:
   ~0,1% bot visits; Google eksplisit ga pakai) & FAQPage schema (rich result
   dihapus Google Mei 2026) — tetap dipasang karena biaya ~nol, tapi jangan
   dianggap growth lever.
3. **Distribusi > SEO untuk breakout.** Riset pasar ID: ga ada preseden
   direktori dev-tool Indonesia yang breakout tanpa dorongan kreator. Lever #1
   secara realistis = kanal Ray sendiri. SEO/GEO = compounding baseline.

## Fase 1 — SHIPPED 2026-07-19 (otomatis, zero intervensi)

| Item | Detail | Bukti/alasan |
|---|---|---|
| Title/meta keyword-first | `{Provider} API Gratis — N Model…` (dulu `{Provider} — tokengratis.id`) | Pattern terbukti buat long-tail "X free API" |
| FAQ section per provider (visible + schema) | Q&A 100% dari field data; field absen → pertanyaan di-skip | Passage-level extraction (paper GEO Princeton: +40% visibility dari citations/statistics) |
| JSON-LD per provider | BreadcrumbList + CollectionPage/ItemList | Parsing aid; bukan citation multiplier (studi Ahrefs) |
| 5 facet pages `/gratis/{vision,image,code,video,audio}` | Di-gate ≥3 provider; `text` (=homepage) & embeddings/reranking (1-2 provider) sengaja SKIP | Facet dari field terstruktur = programmatic paling aman 2026 |
| ~27 cross-provider model pages `/model/[slug]` | Hanya model di ≥2 provider; id per-provider verbatim + disclaimer versi-bisa-beda | Halaman sintesis lintas-sumber = pola yang eksplisit DILINDUNGI kebijakan Google; konten yang ga bisa dibikin single-source manapun |
| Changelog otomatis `/changelog` | Diff nightly (model/provider tambah-hilang) dari pipeline; append data/changelog.json | Freshness + return-visit; pengganti "blog" tanpa nulis |
| IndexNow ping di sync.mjs | POST ke api.indexnow.org tiap sync sukses | Bing index feeds Copilot + ChatGPT Search (dokumen Bing sendiri) |
| llms.txt + llms-full.txt | Auto-generated dari data | Bukti lemah (OtterlyAI ~0,1%), tapi biaya nol & aicredits dkk pakai — speculative keep |
| robots: eksplisit allow AI crawler | GPTBot/ClaudeBot/Claude-User/PerplexityBot/dll | Retrieval bot (Claude-User, OAI-SearchBot, PerplexityBot) = yang menghasilkan citation |
| Sitemap + internal link | Facet di footer, /opensource masuk sitemap | Hub-and-spoke: tiap halaman ≤2 klik dari homepage |

## Fase 2 — Kandidat berikutnya (masih zero-intervensi, BELUM dikerjain)

| Item | Effort | Catatan |
|---|---|---|
| Provenance level-baris-model (sync date di caption tabel model) | S | Bukti GEO terkuat; AI ngutip pasase, bukan halaman |
| Related-providers block di provider page ("provider lain dengan vision") | S | Hub-and-spoke internal linking |
| FAQ homepage dengan phrasing query AI ("LLM API gratis apa aja 2026?") | S | Moderate evidence; jawaban 100% dari data |
| Semantic `<table>` audit (ModelsTable & homepage grid) | M | Klaim "AI parser konversi ke markdown, div-grid hilang" — plausible tapi UNVERIFIED; hati-hati karena desain locked |
| Dataset JSON-LD untuk providers.json aggregate | S | Speculative (Ahrefs: no lift) — biaya nol, prioritas rendah |
| Halaman "cara pakai API {provider}" | M-L | Tutorial-intent SERP ID lebih gede dari directory-intent — TAPI konten tutorial ga bisa 100% auto-generate tanpa risiko halusinasi. Butuh desain hati-hati (langkah generik + link docs resmi doang). Diskusi dulu. |

## Fase 3 — Butuh Ray (distribusi; di luar scope otomatis)

| Lever | Effort | Expected impact |
|---|---|---|
| 1 post/Reel/Short dari kanal utama (YT 3,2M / TikTok 2,3M / IG 1,3M) — bukan cuma Threads | 1x produksi | **Melampaui semua lever lain digabung.** Riset: ga ada direktori ID yang breakout tanpa creator push |
| Threads listicle berkala ("5 API AI gratis baru bulan ini" → link site) | ~15 mnt/bulan | Format terbukti native di Threads ID (@brokariim, @isreza, dkk udah organik) |
| Konten "vibe coding tapi API-nya gratis" | 1x produksi | Tren ID lagi peak, belum ada yang tie-in ke direktori |
| Mention ask ke WPU/Sandhika Galih (979K) / Kelas Terbuka (467K) / Codepolitan | 1 DM | Audience overlap tertinggi; framing edukasi, bukan iklan |
| Post ke GDC Indonesia Discord (38K) + 5-10 grup Telegram dev | 1 jam | Moderate, qualified traffic |
| Bing Webmaster Tools verify (opsional, IndexNow udah jalan tanpa ini) | 5 mnt | Visibility metrics Bing/Copilot |
| **Blog hand-written** (opsional) | Ongoing | Changelog otomatis udah ngasih efek freshness-nya. Blog manusia cuma worth kalau Ray mau nulis; alternatif: repurpose script konten video jadi artikel |

## Yang sengaja DI-SKIP (keputusan tercatat, jangan di-revisit tanpa data baru)

- **400 halaman per-model tunggal** — tipis (~50-80 kata unik vs norma 300-500) + duplikat vs freellm.net/free-model.com/llmreference.com yang pakai data publik sama.
- **276 comparison pages A-vs-B** — textbook scaled-content-abuse 2026. Kalau nanti mau, max 15-20 pasangan curated.
- **Facet embeddings/reranking** — 1-2 provider = thin.
- **llms.txt sebagai growth lever** — dipasang, tapi ekspektasi nol (bukti: OtterlyAI log study, statement Google).
- **FAQPage schema sebagai SEO play** — rich results dihapus Mei 2026; dipasang untuk struktur konten doang.

## Kompetitor yang di-watch

- **nalardeep.com** — satu-satunya kompetitor native-ID ("10+ API LLM Gratis 2026"), blog statis, data stale → keunggulan kita = freshness + rate-limit terstruktur. Re-check berkala.
- **apidog.com/id + getaiperks.com/id** — konten SaaS global ter-translate, dominan di SERP tutorial-intent ID. Generic; celah = suara native + data live.

## Metrik sukses (cek via Cloudflare/Vercel analytics + Search Console)

- Halaman terindex: ~26 → target 55-60 dalam 4-6 minggu.
- Impression Search Console untuk query "api gratis / llm gratis / {provider} gratis".
- Referral dari chat.openai.com / perplexity.ai / copilot (= GEO kerja).
- Return visits ke /changelog.
