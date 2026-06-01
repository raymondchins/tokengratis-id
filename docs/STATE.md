# tokengratis.id — Current State

> **Auto-read on demand** — when prompt asks "current state", "what phase", "what's deployed", "what's blocked". Update on every meaningful push.
>
> **Last updated:** 2026-06-01

## Project Summary

**What:** Directory free AI credits & free tier, Indonesia-first, auto-aggregated dari sumber komunitas. **Aggregator transparan (bukan verifier)**, anti-halusinasi, maintenance ~nol. Social/branding project, bukan startup.
**Deploy target:** https://tokengratis.id (status: 🚧 bootstrapping)
**Vercel fallback:** https://tokengratis-id.vercel.app

## Current phase

**Phase 0 — Bootstrap.** Repo + Vercel project being set up. No app code yet. Spec di `docs/PRD.md`. Next: scaffold Next.js + Tailwind app, design data schema (JSON), build directory + filter UI on seed data, lalu pipeline aggregator.

## Architecture (intentionally minimal — PRD §11)

- **NO database, NO auth, NO backend.** Data = file di repo (JSON/MDX), read-only, regenerate tiap build.
- Static/ISR. Pipeline script jalan nightly (GitHub Actions / Vercel Cron) → fetch sumber → normalize → dedupe → extract opsional (LLM, extract-or-null) → diff → commit/rebuild.

## Infrastructure

| Resource | Status | Location |
|---|---|---|
| GitHub repo `tokengratis-id` | ✅ Live (private) | github.com/raymondchins/tokengratis-id |
| GitHub PAT | ✅ Live | `~/.claude/.credentials.shared` → `GITHUB_PAT` |
| Vercel project | 🚧 Pending | will be `tokengratis-id.vercel.app` |
| Custom domain `tokengratis.id` | 🚧 Pending | Ray punya domain, attach di Vercel |
| Supabase | 🗄️ N/A | no DB by design |
| Auth | 🗄️ N/A | no auth by design |
| LLM key (extract step) | ⏸️ Later | `.credentials` kalau step extract dipakai |

## Data sources wired

| Source | Format | Status |
|---|---|---|
| cheahjs/free-llm-api-resources | GitHub MD | ⏸️ Not yet |
| amardeeplakshkar/awesome-free-llm-apis | GitHub MD | ⏸️ Not yet |
| mnfst/awesome-free-llm-apis | GitHub MD | ⏸️ Not yet |
| aicredits.dev | llms.txt | ⏸️ Not yet |

## Phase Progress

| Phase | Scope | Status |
|---|---|---|
| 0 | Bootstrap (repo + Vercel) | 🚧 In progress |
| 1 | Next.js scaffold + design system (dark/orange) | ⏸️ Pending |
| 2 | Directory + detail + filter/search UI on seed JSON | ⏸️ Pending |
| 3 | Pipeline aggregator (2-3 sources, dedupe, "Synced" labels) | ⏸️ Pending |
| 4 | Nightly cron + auto-rebuild | ⏸️ Pending |
| 5 (opt) | "Masih works? 👍/👎" anonymous counter | ⏸️ v2 maybe |

Legend: ✅ Complete · 🚧 In dev · ⏸️ Pending · 🗄️ N/A

## Open Questions / Blockers

- None blocking. Pipeline LLM-extract step: pakai key apa (Anthropic/Gemini free?) — decide pas masuk Phase 3.

**Action required (Ray):**
- Confirm Vercel project created + domain `tokengratis.id` attached (gw setup, Ray verify).

## Next Up

**Current wave:** Bootstrap → push scaffold → create Vercel project.
**Backlog:** Phase 1 scaffold (Next.js + Tailwind + brand palette).

## Definition of Done (v1 — PRD §13)

- Directory bisa dibuka, di-search, di-filter.
- Tiap entry punya atribusi sumber + tanggal sync + link.
- Pipeline sync jalan otomatis tiap malam, no manual.
- Ga ada satu pun klaim tanpa sumber.
- Situs fresh tanpa Ray ngapa-ngapain.
