# tokengratis.id — Current State

> **Auto-read on demand** — when prompt asks "current state", "what phase", "what's deployed", "what's blocked". Update on every meaningful push.
>
> **Last updated:** 2026-07-25

## Project Summary

**What:** Directory free tier & free credits API LLM, auto-aggregated dari sumber komunitas. **Aggregator transparan (bukan verifier)**, anti-halusinasi, maintenance ~nol. Audience Indonesia. Social/branding project, bukan startup.
**Deploy target:** https://tokengratis.id (status: ✅ live, domain attached)
**Vercel fallback:** https://tokengratis-id.vercel.app

## Current phase

**Phase 6 — dari direktori jadi alat (Pilih → Pasang → Jaga).** Data layer tetap sama (pipeline nightly 4 sumber, **24 provider / 397 model**, dihitung ulang dari `data/providers.json` 2026-07-25). Yang baru: situs ga cuma nampilin daftar, tapi ngebantu user milih, masang, dan tau kalau berubah.

Roadmap + skip-list lengkap (dengan alasan & sumber) di **`docs/PRODUCT-ROADMAP.md`** — disusun 2026-07-25 dari riset 5-arah. Fase 1/2/4/5 dieksekusi; Fase 3 ditunda.

Surface baru:
- `/pilih` — wizard nyaring provider+model (modalitas, context minimum, rate limit)
- `/fallback` — generator rantai multi-provider (Vercel AI SDK / LiteLLM / TypeScript / `.env`)
- Panel "Setup dalam 5 menit" di tiap `/provider/[slug]` — snippet 5 target + `.env`
- `/modal-gratis` + 54 halaman detail — free tier & kredit **di luar** token LLM
- `/feed.xml` (RSS perubahan), `/api/providers` + `/api/models` (JSON, CORS terbuka)
- `packages/tokengratis/` — CLI + MCP server, **zero dependency** — **npm publish DONE** (lihat §Pipeline & npm di bawah, bukan lagi item pending)

Halaman ke-index: 87 → **144 URL sitemap** (hitung ulang dari `app/sitemap.ts`: 2 statis + 24 provider + 5 facet modalitas + 55 model-cluster + 1 changelog + 2 alat + 1 `/modal-gratis` + 54 offer).

## Architecture

- **NO database, NO auth.** Satu-satunya server surface: route Resend newsletter dormant di `app/api/subscribe/route.ts` (belum di-mount di UI). Data = `data/providers.json` (read-only, di-generate `scripts/sync.mjs`).
- Static / SSG (Next.js 16 + Turbopack). `/provider/[slug]` prerendered via `generateStaticParams`. Route `/directory` sudah dihapus (duplikat homepage).
- **Pipeline:** `scripts/sync.mjs` (`npm run sync`) → fetch **4 sumber paralel** via `scripts/adapters/mnfst.mjs` + `scripts/adapters/freellm.mjs` + `scripts/adapters/cheahjs.mjs` + `scripts/adapters/openrouter.mjs` → **shape-guard per-source** (`scripts/lib/shape-guard.mjs`) → merge/gap-fill by priority di `scripts/lib/merge.mjs` → **shape-guard on merged output** → enrich context/maxOutput dari models.dev (`scripts/lib/enrich.mjs`) → **diff-guard vs last-known-good** (`scripts/lib/diff-guard.mjs`) → smoke test → tulis `data/providers.json` + `data/sync-report.json`. LLM fallback (`scripts/lib/llm-fallback.mjs`, Claude Haiku) re-parse sumber unstructured yang drift kalau `ANTHROPIC_API_KEY` ada (raw API) ATAU `CLAUDE_CODE_OAUTH_TOKEN` di-set (headless Claude Code, subscription Max). Idempotent.
- **Nightly cron:** `.github/workflows/nightly-sync.yml` (cron `0 19 * * *`) — auto-commit data + trigger Vercel rebuild. Run gagal → buka/update GitHub issue (isi dari `sync-report.json`) — zero-setup alert, GitHub email owner otomatis.

## Pipeline guards — bentuk nilai, bukan cuma kuantitas (2026-07-25)

**INCIDENT 2026-07-25:** freellm.net nyisipin kolom "Score" baru dan ngilangin "Max Output" di layout-nya. Jumlah kolom & jumlah baris ga berubah → sanity floor (kuantitas provider/model), diff guard lama (id churn), dan smoke test SEMUA lolos, sementara `context` diam-diam kebaca dari kolom Score. **216 dari 398 model salah selama berminggu-minggu** — ketahuan bukan dari guard, tapi manusia ngeliat `context=81` ganjil di output CLI. Root fix di `2f04f70` (adapter map kolom by nama header, bukan posisi); guard baru di `bfd35ed` biar kelas bug ini ga bisa lolos lagi.

Yang sekarang ada:
- **`scripts/lib/shape-guard.mjs`** — 8 aturan ratio-based ngukur BENTUK nilai (context/maxOutput bukan bilangan bulat telanjang <1000, bukan currency/tanggal/persentase, dst). Fatal **cuma kalau sistemik** (>50% dgn sampel ≥20) — satu baris ganjil ga pernah jatohin nightly run. Export: `checkShape`, `assertShape`, `looksLikeContext`, `looksLikeRateLimit`, `ShapeGuardError`.
- **`scripts/lib/diff-guard.mjs` Rule 6** — field-value churn antar run (bukan cuma id/count churn). `null → value` dari enrichment sengaja dikecualiin, biar gap-fill models.dev ga bikin nightly flap.
- **4 adapter di-harden:** `freellm` + `cheahjs` map kolom by NAMA header (throw kalau kolom yang di-depend ilang); `mnfst` + `openrouter` validasi shape upstream + isi rate — openrouter paling kritis karena dia ga punya baseline di `source-sanity.mjs`, jadi 0-model result diam-diam bisa lolos sebelum ini.
- **`scripts/sync.mjs`** jalanin `checkShape` per-source DAN di output merged. Fatal per-source → skip sumber itu doang; fatal di merged → abort write, exit 1. Warning selalu print, ga pernah blocking.
- **`data/sync-report.json`** — laporan run machine-readable, di-commit sebagai audit trail.
- **`npm test`** — **94 self-test lintas 6 modul, full offline** (shape-guard 30, diff-guard 16, source-sanity 18, cheahjs 13, mnfst 8, openrouter 9).

**Bukti end-to-end (diverifikasi ulang manual saat nulis STATE.md ini, bukan cuma diklaim):**

| Cek | Pre-fix `c95ee6d` | Post-fix `2f04f70` |
|---|---|---|
| `checkShape` (`source: "freellm.net"`) | **FATAL** — `context`: 216/343 (63.0%), sample `["81","55","52"]` | `ok: true`, 0 issue |
| `snapshotDiff` pre→post (kalau ini kejadian nightly beneran) | — | **BLOCKED**: `context` model-level churn 62.4% (211/338), `maxContext` provider-level churn 41.7% (10/24) — di atas ambang error 35% |
| `snapshotDiff` nightly normal (`e137dc6`→`681de9a`, no incident) | `ok: true`, churn 0–0.6% semua field | tanpa false positive |

Kesimpulan: guard baru nangkep incident lama secara retroaktif (fatal + blocked) DAN ga bunyi di data sehat (zero false positive di 2 sample independen).

## Data model — "modal gratis" (canonical = `lib/offer-types.ts`)

Entity **terpisah** dari Provider/Model, sengaja. Skema LLM (context/modality/rateLimit) ga muat buat "10 GB storage" atau "$10.000 credit" — dipaksa jadi satu = kolom kosong bertaburan, persis yang dilarang aturan #1.

- **Offer:** slug · name · vendor · domain · category (10 kategori) · kind (`free_tier`/`credit`/`trial`/`program`) · url · description · limits[] · creditValue · requirements[] · **traps[]** · facets[] · idIndie (`bisa`/`tidak`/`belum_jelas`) · sources[] (tiap OfferSource: name/url/**checkedAt**).
- **`facets` itu TURUNAN**, bukan penilaian — cuma boleh nempel kalau ada baris di limits/requirements/traps yang mendukung. Pola sama kayak `Provider.modalities` yang di-derive dari string modality sumber.
- **`sources[].url` WAJIB halaman resmi vendor.** Situs agregator DILARANG — riset nemu agregator saling bertentangan (tier Cloudflare versi agregator $5K/$25K/$100K vs halaman resmi $10K/$100K/$350K).
- **Kurasi manual, kadens mingguan** — BUKAN adapter nightly. Alasannya: nol sumber machine-readable di domain ini (free-for-dev pun ga encode angka kuota). Ini bukan kemalasan, ini temuan riset.
- `checkedAt` = kapan halaman dibaca. Provenance, BUKAN klaim "masih benar sekarang". Tetap dilarang pakai kata "Verified".

## Data model — LLM (canonical = `lib/types.ts`)

- **Provider:** slug, name, category (`provider_api`/`inference_provider`), country+flag, domain+logo (favicon, fallback flag), url, baseUrl, description (prosa apa adanya), modalities[] (facet), modelCount, maxContext, freeLimit (derived dari description), models[], sources[] (provenance array — tiap SourceRef: name/url/syncedAt), syncedAt, sourceUpdatedAt.
- **Model:** id, name, context, maxOutput, modality, rateLimit.
- **DIBUANG (2026-06-01):** requiresCreditCard, requiresPhoneVerification, indonesiaAccess, offerType, freeQuota — ga ada sumber yang track terstruktur → "Unknown" bertaburan. Info itu kalau ada tetep di `description`.

## Design

Light / paper / neutral ala getaiperks.com. bg `#f1f0e8`, card putih, text `#11181c`, tombol pure black, accent hijau (`grass`) + ungu (`grape`). Heading Georgia serif, body Inter. Token di `app/globals.css`. Oren `#dc4f1c` di-pause (revert = 1-2 baris).

## Infrastructure

| Resource | Status | Location |
|---|---|---|
| GitHub repo `tokengratis-id` | ✅ Live (public) | github.com/raymondchins/tokengratis-id |
| Vercel project | ✅ Live | tokengratis-id.vercel.app |
| Custom domain `tokengratis.id` | ✅ Live | attached di Vercel |
| Nightly cron | ✅ Live | `.github/workflows/nightly-sync.yml` |
| npm package `tokengratis` | ✅ **Live, v0.1.1 published** | registry.npmjs.org/tokengratis — CLI + MCP server, zero-dep, `--refresh`/`--no-cache` + data-age print |
| Supabase / Auth | 🗄️ N/A | no DB / no auth by design |

## Data sources wired

| Source | Format | Adapter | Status |
|---|---|---|---|
| mnfst/awesome-free-llm-apis | JSON (`data.json`) | `scripts/adapters/mnfst.mjs` | ✅ **Live, prioritas #1** (non-openrouter) — shape-validated |
| freellm.net | HTML table (server-rendered) | `scripts/adapters/freellm.mjs` | ✅ Live — kolom di-map by NAMA header (post-INCIDENT 2026-07-25 hardening), throw kalau kolom "Context" ilang |
| cheahjs/free-llm-api-resources | README markdown | `scripts/adapters/cheahjs.mjs` | ✅ Live — kolom di-map by NAMA header, throw kalau kolom nama model ilang |
| openrouter.ai/api/v1/models | JSON live API (no auth) | `scripts/adapters/openrouter.mjs` | ✅ Live (authoritative buat provider `openrouter`, filter `:free`) — shape-validated, no baseline di source-sanity jadi ini lapisan pelindung utamanya |
| models.dev | JSON (`api.json`) — enrichment | `scripts/lib/enrich.mjs` | ✅ Live (gap-fill context/maxOutput post-merge, exact match doang) |
| amardeeplakshkar/awesome-free-llm-apis | GitHub MD | — | ⏸️ Belum di-ingest |
| aicredits.dev | llms.txt | — | ⏸️ Belum di-ingest (scope luas) |

Guard tambahan (bukan sumber, lapisan validasi): `scripts/lib/shape-guard.mjs` (bentuk nilai, per-source + merged) + `scripts/lib/diff-guard.mjs` Rule 6 (field-value churn antar run). Detail incident + bukti di §"Pipeline guards" di atas.

**LLM fallback:** `scripts/lib/llm-fallback.mjs` (Claude Haiku) re-parse freellm/cheahjs kalau regex drift di bawah sanity floor — aktif kalau `ANTHROPIC_API_KEY` di-set (repo secret di CI, raw API) ATAU `CLAUDE_CODE_OAUTH_TOKEN` di-set (headless Claude Code, subscription Max). Hasil tetap lewat semua guard.

## Phase Progress

| Phase | Scope | Status |
|---|---|---|
| 0 | Bootstrap (repo + Vercel) | ✅ Done |
| 1 | Next.js scaffold + design system | ✅ Done (light/paper neutral, getaiperks-style) |
| 2 | Directory + detail + filter/search UI | ✅ Done (tabel, real data) |
| 3 | Pipeline aggregator (mnfst JSON, anchor) | ✅ Done |
| 4 | Nightly cron + auto-rebuild | ✅ Done (GitHub Actions nightly-sync.yml) |
| 4b | Multi-source (freellm.net + cheahjs) + 3-way merge | ✅ Done (~26 provider) |
| 4c | Sumber ke-4 (openrouter live API) + enrichment models.dev + LLM fallback + rolling baselines | ✅ Done (2026-06-10) |
| 5 (opt) | Tambah sumber (amardeeplakshkar/aicredits) | ⏸️ v2 maybe |
| 6a | PASANG — `/pilih`, `/fallback`, panel setup per-provider | ✅ Done (2026-07-25) |
| 6b | JAGA — RSS `/feed.xml` dari diff nightly | ✅ Done (2026-07-25) |
| 6c | Distribusi — `/api/providers`, `/api/models`, CLI + MCP zero-dep | ✅ Done, **npm publish 0.1.1 SELESAI** (2026-07-25 — CLI `--refresh`/data-age fix landed lalu di-publish) |
| 6d | Ekspansi — `/modal-gratis`, 54 offer terkurasi | ✅ Done (2026-07-25) |
| 6e | JAGA — status ping 8–10 provider | ⏸️ Blocked: butuh 8–10 API key atas nama Ray |
| 6f | JAGA — Telegram channel + email digest | ⏸️ Di-skip atas permintaan Ray |
| — | Pipeline hardening — shape-guard + diff-guard Rule 6 | ✅ Done (2026-07-25), lihat §Pipeline guards |

Legend: ✅ Complete · 🚧 In dev · ⏸️ Pending · 🗄️ N/A

## Open Questions / Blockers

- Akses-Indonesia descoped permanently (no structured source); info itu kalau ada tetap di teks `description`.
- **Monetisasi masih TUTUP.** `CLAUDE.md` bilang "BUKAN dimonetisasi" — belum diubah. Ladder rekomendasi (affiliate → API data → jembatan bayar IDR brand terpisah) ada di `docs/PRODUCT-ROADMAP.md` §6, termasuk checklist regulasi (PT Perorangan Rp50rb, nebeng PJP berlisensi, closed-loop < Rp1 M/bln float, PSE Komdigi).
- **Gateway/proxy free-tier DITOLAK PERMANEN** — bukan abu-abu. OpenRouter ToS §7.4, Groq SA §3.2/§6.3, Mistral, Gemini Terms melarang eksplisit; plus rate limit Groq per-organisasi bikin shared key 429 berjamaah. Jangan dibuka lagi tanpa data baru. Detail di `docs/PRODUCT-ROADMAP.md` §5.
- **`/modal-gratis` butuh refresh manual** (~mingguan). Ini satu-satunya bagian situs yang ga self-maintaining — konsekuensi sadar dari nol sumber machine-readable.

## Next Up

**Butuh Ray:** (1) 8–10 API key provider kalau mau Fase 6e (status ping); (2) bikin bot Telegram (~5 menit) kalau mau Fase 6f dibuka lagi; (3) **distribusi** — proyek belum di-post ke kanal komunitas manapun (Dicoding, YouTube dev ID, grup FB PHP/Java Indonesia, Telegram dev ID) — `docs/PRODUCT-ROADMAP.md` §7 bilang ini nentuin traffic lebih dari 10 halaman SEO baru, murni butuh Ray posting, bukan kode. *(npm publish `packages/tokengratis` v0.1.1 — SELESAI 2026-07-25, dihapus dari daftar ini.)*

**Backlog:** Tambah sumber amardeeplakshkar/aicredits.dev (butuh parser). Analytics: matiin Vercel analytics setelah angka Cloudflare stabil (banding 2-3 minggu). Refresh `data/offers.json` mingguan.

## Definition of Done (v1)

- ✅ Directory bisa dibuka, di-search, di-filter.
- ✅ Tiap provider punya atribusi sumber + tanggal sync + link.
- ✅ Ga ada klaim tanpa sumber (zero "Unknown" tebakan).
- ✅ Pipeline sync jalan otomatis tiap malam (cron live).
