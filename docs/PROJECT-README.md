# tokengratis.id

> **30-second orientation.** Working style → `~/.claude/playbook/PLAYBOOK.md`. Current state → `docs/STATE.md`. History → `docs/CHANGELOG.md`. Numbered learnings → `docs/log.md`.

Directory free AI credits & free tier, Indonesia-first, auto-aggregated dari sumber komunitas. Aggregator transparan (bukan verifier), anti-halusinasi, maintenance nyaris nol.

## Quick facts

| | |
|---|---|
| **Live URL** | https://<canonical-domain> |
| **Vercel fallback** | https://tokengratis-id.vercel.app |
| **GitHub repo** | https://github.com/raymondchins/tokengratis-id (Private) |
| **Supabase project** | `<project_ref>` · `<region>` · Free plan |
| **Supabase SQL Editor** | https://supabase.com/dashboard/project/<project_ref>/sql/new |
| **Vercel project** | `tokengratis-id` · team `raymondchins-projects` · region `<region>` |
| **Stack** | <e.g., Next.js 16 + TypeScript strict + Supabase Postgres + RLS + Tailwind 4 + shadcn/ui> |
| **Domain** | `tokengratis-id.raymondchins.com` |

## Files in this folder

| File | What | When to read |
|---|---|---|
| `CLAUDE.md` | Project-specific rules (stack, URL, overrides) | Auto-loaded every session |
| `docs/STATE.md` | Current state SoT | Read on demand when prompt asks about state/phase |
| `docs/log.md` | Numbered learnings + decisions (append-only) | Read on demand for learning archeology |
| `docs/CHANGELOG.md` | Append-only chronological history | Read on demand for what shipped when |
| `.credentials` | Supabase publishable + secret keys | `source` before cred-using actions (gitignored) |
| `supabase/migrations/` | All migrations (committed) | Reference when debugging or re-running |

## Daily workflow

1. New session → Claude reads `CLAUDE.md` (auto-loaded) → reads `docs/STATE.md` on demand.
2. Ray gives feedback / bug / feature request.
3. Claude implements → push to feature branch → Vercel preview → PR.
4. After Ray approval → merge to `main` → Vercel auto-deploys prod.
5. Migration baru? → apply via Supabase MCP `apply_migration` → update migrations table in `docs/STATE.md`.
6. Every push: test cases in chat + append entry to `docs/CHANGELOG.md` (bash `>>`).
7. New learning? → append to `docs/log.md`, tag `[UNIVERSAL?]` if cross-project.

## Conventions (deltas from playbook default)

- **Default working style:** see `~/.claude/playbook/PLAYBOOK.md`.
- _(list any project-specific deviations here)_
