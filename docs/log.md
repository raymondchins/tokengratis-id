# tokengratis.id — Build Log & Learnings

> **Append-only.** Numbered learnings + key technical decisions. NEVER renumber existing entries.
>
> **Current state lives in `STATE.md`** (lighter, read more often). This file = the archive.
>
> **Universal gotchas** (Postgres, Next.js, Vercel, Supabase, security): see `~/.claude/playbook/PLAYBOOK-REFERENCE.md`. Promoted learnings (≥2 project): `~/.claude/playbook/LEARNINGS.md`. Project-specific entries below.

---

## How to add a learning

1. Append next-numbered entry at the end.
2. Format:
   ```
   ### N. <Short title>

   **Context:** what triggered this (incident, feature, debug session).

   **Learning:** what we now know.

   **How to apply:** when this pattern recurs, do X.

   **Tag:** `[UNIVERSAL?]` if applies to ≥2 projects (for promotion scan).
   ```
3. End-of-session: scan `[UNIVERSAL?]` entries → run `/promote-learning N` to lift to `~/.claude/playbook/LEARNINGS.md`.

---

## Numbered learnings

### 1. _(first learning here)_

**Context:** _(what triggered)_

**Learning:** _(what we know now)_

**How to apply:** _(when this recurs, do X)_

---

## Key technical decisions

_(record major architecture / API contract / schema choices with rationale)_

- **YYYY-MM-DD — <Decision>:** _(rationale, alternatives considered, tradeoffs)_

---

## Handoff notes for future sessions

1. **Read `docs/STATE.md` FIRST** — current state (~50 lines).
2. **`~/.claude/playbook/PLAYBOOK.md`** = universal working style + subagent rules.
3. **Source credentials** before any cred-using action:
   ```bash
   set -a
   source ~/.claude/.credentials.shared
   [ -f .credentials ] && source .credentials
   [ -f .env.local ] && source .env.local
   set +a
   [ -n "$GITHUB_PAT" ] && export GH_TOKEN="$GITHUB_PAT"
   ```
4. **Project-specific deltas:** _(list things this project does differently from playbook default)_

---

## Update protocol

- **Universal gotcha (Postgres / Next.js / Vercel / Supabase / security)** → check if already in `~/.claude/playbook/PLAYBOOK-REFERENCE.md` or `LEARNINGS.md`. If yes, reference it. If no, write here + tag `[UNIVERSAL?]` + scan for promotion at session end.
- **Project-specific learning** → write here as next-numbered entry. No promotion needed.
- **Decision made** → append to Key Technical Decisions section with date + rationale.
- **State change** (migration RUN, phase shift, blocker change) → update `STATE.md`, not here.
