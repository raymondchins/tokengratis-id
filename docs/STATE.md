# tokengratis.id — Current State

> **Auto-read on demand** — when prompt asks "current state", "what phase", "what's deployed", "what's blocked". Update on every meaningful push.
>
> **Last updated:** 2026-06-10

## Project Summary

**What:** Directory free tier & free credits API LLM, auto-aggregated dari sumber komunitas. **Aggregator transparan (bukan verifier)**, anti-halusinasi, maintenance ~nol. Audience Indonesia. Social/branding project, bukan startup.
**Deploy target:** https://tokengratis.id (status: ✅ live, domain attached)
**Vercel fallback:** https://tokengratis-id.vercel.app

## Current phase

**Phase 4+ — Directory live, 4-source + enrichment + LLM fallback + rolling baselines.** App jalan: homepage (hero serif + tabel), `/provider/[slug]`. Data dari pipeline `npm run sync` (4 sumber paralel + enrichment models.dev + LLM fallback Claude Haiku + rolling baselines, ~26 provider). Nightly cron live via GitHub Actions. Domain attach ke Vercel sudah dilakukan. LLM fallback (Haiku) aktif kalau `ANTHROPIC_API_KEY` di-set (raw API) ATAU `CLAUDE_CODE_OAUTH_TOKEN` ada (headless CLI).

## Architecture

- **NO database, NO auth.** Satu-satunya server surface: route Resend newsletter dormant di `app/api/subscribe/route.ts` (belum di-mount di UI). Data = `data/providers.json` (read-only, di-generate `scripts/sync.mjs`).
- Static / SSG (Next.js 16 + Turbopack). `/provider/[slug]` prerendered via `generateStaticParams`. Route `/directory` sudah dihapus (duplikat homepage).
- **Pipeline:** `scripts/sync.mjs` (`npm run sync`) → fetch **4 sumber paralel** via `scripts/adapters/mnfst.mjs` + `scripts/adapters/freellm.mjs` + `scripts/adapters/cheahjs.mjs` + `scripts/adapters/openrouter.mjs` → merge/gap-fill by priority di `scripts/lib/merge.mjs` → enrich context/maxOutput dari models.dev (`scripts/lib/enrich.mjs`) → smoke test → tulis `data/providers.json`. LLM fallback (`scripts/lib/llm-fallback.mjs`, Claude Haiku) re-parse sumber unstructured yang drift kalau `ANTHROPIC_API_KEY` ada (raw API) ATAU `CLAUDE_CODE_OAUTH_TOKEN` di-set (headless Claude Code, subscription Max). Idempotent.
- **Nightly cron:** `.github/workflows/nightly-sync.yml` (cron `0 19 * * *`) — auto-commit data + trigger Vercel rebuild.

## Data model (canonical = `lib/types.ts`)

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
| Supabase / Auth | 🗄️ N/A | no DB / no auth by design |

## Data sources wired

| Source | Format | Adapter | Status |
|---|---|---|---|
| mnfst/awesome-free-llm-apis | JSON (`data.json`) | `scripts/adapters/mnfst.mjs` | ✅ **Live, prioritas #1** (non-openrouter) |
| freellm.net | HTML table (server-rendered) | `scripts/adapters/freellm.mjs` | ✅ Live |
| cheahjs/free-llm-api-resources | README markdown | `scripts/adapters/cheahjs.mjs` | ✅ Live |
| openrouter.ai/api/v1/models | JSON live API (no auth) | `scripts/adapters/openrouter.mjs` | ✅ Live (authoritative buat provider `openrouter`, filter `:free`) |
| models.dev | JSON (`api.json`) — enrichment | `scripts/lib/enrich.mjs` | ✅ Live (gap-fill context/maxOutput post-merge, exact match doang) |
| amardeeplakshkar/awesome-free-llm-apis | GitHub MD | — | ⏸️ Belum di-ingest |
| aicredits.dev | llms.txt | — | ⏸️ Belum di-ingest (scope luas) |

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

Legend: ✅ Complete · 🚧 In dev · ⏸️ Pending · 🗄️ N/A

## Open Questions / Blockers

- None blocking. Akses-Indonesia descoped permanently (no structured source); info itu kalau ada tetap di teks `description`.

## Next Up

**Backlog:** Tambah sumber amardeeplakshkar/aicredits.dev (butuh parser). Analytics: matiin Vercel analytics setelah angka Cloudflare stabil (banding 2-3 minggu).

## Definition of Done (v1)

- ✅ Directory bisa dibuka, di-search, di-filter.
- ✅ Tiap provider punya atribusi sumber + tanggal sync + link.
- ✅ Ga ada klaim tanpa sumber (zero "Unknown" tebakan).
- ✅ Pipeline sync jalan otomatis tiap malam (cron live).
