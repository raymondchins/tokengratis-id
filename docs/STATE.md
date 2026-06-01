# tokengratis.id — Current State

> **Auto-read on demand** — when prompt asks "current state", "what phase", "what's deployed", "what's blocked". Update on every meaningful push.
>
> **Last updated:** 2026-06-01

## Project Summary

**What:** Directory free tier & free credits API LLM, auto-aggregated dari sumber komunitas. **Aggregator transparan (bukan verifier)**, anti-halusinasi, maintenance ~nol. Audience Indonesia. Social/branding project, bukan startup.
**Deploy target:** https://tokengratis.id (status: 🚧 domain pending attach)
**Vercel fallback:** https://tokengratis-id.vercel.app

## Current phase

**Phase 2/3 — Directory live di data real.** App jalan: homepage (hero serif + tabel), `/directory`, `/provider/[slug]`. Data dari pipeline `npm run sync` (mnfst `data.json`, 24 provider). Next: cron nightly + attach domain Vercel.

## Architecture

- **NO database, NO auth, NO backend.** Data = `data/providers.json` (read-only, di-generate `scripts/sync.mjs`).
- Static / SSG (Next.js 16 + Turbopack). `/provider/[slug]` prerendered via `generateStaticParams`.
- **Pipeline:** `scripts/sync.mjs` (`npm run sync`) → fetch mnfst `data.json` → normalize (derive facet modality + maxContext) → tulis `data/providers.json`. Idempotent. Belum di-cron (masih manual / on-build).

## Data model (canonical = `lib/types.ts`)

- **Provider:** slug, name, category (`provider_api`/`inference_provider`), country+flag, url, baseUrl, description (prosa apa adanya), modalities[] (facet), modelCount, maxContext, models[], source, syncedAt, sourceUpdatedAt.
- **Model:** id, name, context, maxOutput, modality, rateLimit.
- **DIBUANG (2026-06-01):** requiresCreditCard, requiresPhoneVerification, indonesiaAccess, offerType, freeQuota — ga ada sumber yang track terstruktur → "Unknown" bertaburan. Info itu kalau ada tetep di `description`.

## Design

Light / paper / neutral ala getaiperks.com. bg `#f1f0e8`, card putih, text `#11181c`, tombol pure black, accent hijau (`grass`) + ungu (`grape`). Heading Georgia serif, body Inter. Token di `app/globals.css`. Oren `#dc4f1c` di-pause (revert = 1-2 baris).

## Infrastructure

| Resource | Status | Location |
|---|---|---|
| GitHub repo `tokengratis-id` | ✅ Live (private) | github.com/raymondchins/tokengratis-id |
| GitHub PAT | ✅ Live | `~/.claude/.credentials.shared` → `GITHUB_PAT` |
| Vercel project | 🚧 Pending | will be `tokengratis-id.vercel.app` |
| Custom domain `tokengratis.id` | 🚧 Pending | Ray punya domain, attach di Vercel |
| Supabase / Auth | 🗄️ N/A | no DB / no auth by design |

## Data sources wired

| Source | Format | Status |
|---|---|---|
| mnfst/awesome-free-llm-apis | JSON (`data.json`) | ✅ **Live anchor** — 24 provider |
| cheahjs/free-llm-api-resources | GitHub MD | ⏸️ Cross-ref (butuh scraping) |
| amardeeplakshkar/awesome-free-llm-apis | GitHub MD | ⏸️ Cross-ref |
| aicredits.dev | llms.txt | ⏸️ Cross-ref (startup credits, scope luas) |

## Phase Progress

| Phase | Scope | Status |
|---|---|---|
| 0 | Bootstrap (repo + Vercel) | ✅ Done (repo) / 🚧 Vercel |
| 1 | Next.js scaffold + design system | ✅ Done (light/paper neutral, getaiperks-style) |
| 2 | Directory + detail + filter/search UI | ✅ Done (tabel, real data) |
| 3 | Pipeline aggregator (mnfst JSON) | ✅ Done (`npm run sync`, 24 provider) |
| 4 | Nightly cron + auto-rebuild | ⏸️ Pending (GitHub Actions / Vercel Cron) |
| 5 (opt) | Tambah sumber (cheahjs/aicredits) + "masih works?" | ⏸️ v2 maybe |

Legend: ✅ Complete · 🚧 In dev · ⏸️ Pending · 🗄️ N/A

## Open Questions / Blockers

- None blocking. Akses-Indonesia descoped (no source); kalau mau hidupin → layer editorial manual (lihat log.md).

**Action required (Ray):**
- Confirm Vercel project + domain `tokengratis.id` attached.

## Next Up

**Current wave:** Push ke main (done) → setup Vercel project + domain.
**Backlog:** GitHub Actions cron buat `npm run sync` nightly + auto-commit/rebuild. Tambah cheahjs/aicredits sources (butuh parser markdown/llms.txt).

## Definition of Done (v1)

- ✅ Directory bisa dibuka, di-search, di-filter.
- ✅ Tiap provider punya atribusi sumber + tanggal sync + link.
- ✅ Ga ada klaim tanpa sumber (zero "Unknown" tebakan).
- ⏸️ Pipeline sync jalan otomatis tiap malam (cron belum).
