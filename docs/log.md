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

### 1. Schema harus ngikut apa yang sumber BENERAN punya, bukan apa yang "ideal"

**Context:** PRD awal nge-spec field CC-required / phone-required / akses-Indonesia / freeQuota / offerType. Pas isi data, hampir semua jadi "Unknown" → UI tabel jelek (kolom kosong di mana-mana). Riset 3 sumber utama (cheahjs, mnfst, aicredits) konfirmasi: ZERO sumber yang track field itu secara terstruktur — paling banter ada di prosa.

**Learning:** Mendesain schema dari "apa yang pengen ditampilin" (wishlist) ketabrak realita sumber. Yang reliable cuma: provider, model, context, modality, rate limit, signup url. Field aspirasional yang ga ada sumbernya = "Unknown" generator = anti-pattern UI + lawan prinsip anti-halusinasi.

**How to apply:** Sebelum bikin field/kolom, cek dulu sumber NYEDIAIN data itu terstruktur apa ga. Kalau cuma kadang muncul di prosa → simpan utuh sebagai `description`, JANGAN bikin kolom boolean/tristate yang mayoritas "Unknown". "Drop the column" > "show Unknown".

**Tag:** `[UNIVERSAL?]` (data-modeling: schema follows source reality, not wishlist — relevan ke project aggregator/scraper manapun.)

### 2. Pilih sumber by machine-readability, bukan popularity

**Context:** cheahjs paling terkenal/aktif tapi markdown-only (butuh scraping rapuh). mnfst (4.7k⭐) punya `data.json` bersih + terstruktur.

**Learning:** Buat aggregator maintenance-nol, sumber dengan JSON/structured output >> sumber populer tapi markdown. Scraping markdown = brittle + maintenance.

**How to apply:** Saat milih sumber data, prioritas: (1) ada JSON/API publik? (2) maintained? (3) coverage. Anchor ke yang structured, sisanya cross-ref belakangan.

---

## Key technical decisions

_(record major architecture / API contract / schema choices with rationale)_

- **2026-06-01 — Anchor data = mnfst `data.json`:** Pilih mnfst/awesome-free-llm-apis sebagai sumber utama (JSON bersih, 24 provider, model-level). Alternatif (cheahjs/amardeeplakshkar = markdown, aicredits = llms.txt prosa) ditunda — butuh parser. Tradeoff: coverage lebih kecil tapi reliability + maintenance ~nol menang.
- **2026-06-01 — Buang field CC/HP/akses-Indonesia:** Ga ada sumber yang track terstruktur → selalu "Unknown". Indonesia-first di-reframe jadi audience/bahasa, bukan klaim filtering akses. Kalau mau hidupin lagi → WAJIB layer editorial manual (lawan maintenance-nol, jadi ditahan).
- **2026-06-01 — Desain pivot ke light/paper neutral (getaiperks-style):** Dari dark/oren brand palette → light paper + Georgia serif + Inter + accent hijau/ungu. Oren di-pause (token-based, revert 1-2 baris). Rationale: Ray mau ikut UI language getaiperks.com.

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
