# tokengratis.id

> **30-second orientation.** Setup → `README.md`. Spec → `docs/PRD.md`. Current state → `docs/STATE.md`. History → `docs/CHANGELOG.md`. Numbered learnings → `docs/log.md`.

Directory free tier & free credits API LLM, audience Indonesia, auto-aggregated dari sumber komunitas. Aggregator transparan (bukan verifier), anti-halusinasi, maintenance nyaris nol. **No DB, no auth, no backend** — data = `data/providers.json` (di-generate `npm run sync`).

## Quick facts

| | |
|---|---|
| **Live URL** | https://tokengratis.id |
| **Vercel fallback** | https://tokengratis-id.vercel.app |
| **GitHub repo** | https://github.com/raymondchins/tokengratis-id |
| **Stack** | Next.js 16 (App Router, Turbopack) + TypeScript strict + Tailwind 4. Static/SSG. |
| **Data** | `data/providers.json` ← `scripts/sync.mjs` (4 sumber: mnfst / freellm.net / cheahjs / openrouter + enrichment models.dev). NO database. |
| **Design** | Light/paper neutral (getaiperks-style), Georgia serif + Inter |

## Files in this folder

| File | What | When to read |
|---|---|---|
| `CLAUDE.md` | Project-specific rules (stack, URL, overrides) | Auto-loaded every session |
| `docs/STATE.md` | Current state SoT | Read on demand when prompt asks about state/phase |
| `docs/log.md` | Numbered learnings + decisions (append-only) | Read on demand for learning archeology |
| `docs/CHANGELOG.md` | Append-only chronological history | Read on demand for what shipped when |
| `lib/types.ts` | Schema canonical (Provider + Model) | Reference sebelum nyentuh data/UI |
| `scripts/sync.mjs` | Pipeline aggregator (`npm run sync`) | Reference saat refresh / tambah sumber |

## Contribution flow

1. Read `CONTRIBUTING.md` + the core principle in `CLAUDE.md` (aggregator, not verifier).
2. Branch off `main` → make the change → `npm test` + `npm run build` locally.
3. Open a PR against `main`. CI runs typecheck + build + pipeline self-tests.
4. On merge, Vercel auto-deploys production.
5. Notable changes → append an entry to `docs/CHANGELOG.md`; new learnings → `docs/log.md`.

**Note:** no DB / no migrations. Only server surface = dormant Resend newsletter route (`app/api/subscribe`) — not mounted in UI, no state stored.

## Conventions

Project-specific rules live in `CLAUDE.md` (core principle, anti-patterns, schema). The pipeline is the only moving part — see `scripts/sync.mjs` and `CONTRIBUTING.md`.
