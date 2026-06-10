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

### 2. Cross-source references HARUS keyed by source label, jangan positional/first-match

**Context:** Saat implementasi openrouter authoritative-trim (drop model openrouter dari group mnfst kalau ga ada di live API), code cari "grup pertama yang ada di partialGroups" → ternyata tangkap group mnfst, bukan live API openrouter. Hasil: 19 model openrouter live ke-drop salah. Nyari source reference pakai `partialGroups.indexOf(sourceLabel)` ambil index pertama → itu group mnfst. Fix: capture reference explicitly `partialGroups.findIndex(g => g === sourceLabelToMatch)`.

**Learning:** Kalau multi-source aggregator, cross-reference antar group/source WAJIB by **key/label, bukan positional first-match**. Positional reference brittle, makan waktu debug.

**How to apply:** Saat nyari sumber specific di list partai/groups (model list, provider group, format variant), selalu pakai `.find()` / `.findIndex()` dengan explicit label match, JANGAN `.indexOf()` first occurrence. Apply ke future multi-format sumber juga (kalau cheahjs + amardeeplakshkar keduanya masuk).

**Tag:** `[UNIVERSAL?]` (data-aggregation: keyed reference > positional — relevan ke parser manapun yang merge multi-format).

### 3. Pilih sumber by machine-readability, bukan popularity

**Context:** cheahjs paling terkenal/aktif tapi markdown-only (butuh scraping rapuh). mnfst (4.7k⭐) punya `data.json` bersih + terstruktur.

**Learning:** Buat aggregator maintenance-nol, sumber dengan JSON/structured output >> sumber populer tapi markdown. Scraping markdown = brittle + maintenance.

**How to apply:** Saat milih sumber data, prioritas: (1) ada JSON/API publik? (2) maintained? (3) coverage. Anchor ke yang structured, sisanya cross-ref belakangan.

---

## Key technical decisions

_(record major architecture / API contract / schema choices with rationale)_

- **2026-06-01 — Anchor data = mnfst `data.json`:** Pilih mnfst/awesome-free-llm-apis sebagai sumber utama (JSON bersih, 24 provider, model-level). Alternatif (cheahjs/amardeeplakshkar = markdown, aicredits = llms.txt prosa) ditunda — butuh parser. Tradeoff: coverage lebih kecil tapi reliability + maintenance ~nol menang.
- **2026-06-01 — Buang field CC/HP/akses-Indonesia:** Ga ada sumber yang track terstruktur → selalu "Unknown". Indonesia-first di-reframe jadi audience/bahasa, bukan klaim filtering akses. Kalau mau hidupin lagi → WAJIB layer editorial manual (lawan maintenance-nol, jadi ditahan).
- **2026-06-01 — Desain pivot ke light/paper neutral (getaiperks-style):** Dari dark/oren brand palette → light paper + Georgia serif + Inter + accent hijau/ungu. Oren di-pause (token-based, revert 1-2 baris). Rationale: Ray mau ikut UI language getaiperks.com.
- **2026-06-10 — Sumber ke-4: openrouter live API + authoritative-for-self:** Pilih openrouter sebagai sumber ke-4 (live API, public, no auth) filter `:free` only. Emit single provider `openrouter`, authoritative buat model list sendiri (post-merge, pangkas ke model beneran live → entri komunitas stale auto-drop nightly). Rationale: live source = freshest, authoritative pattern mencegah staleness dari crowd-sourced entry.
- **2026-06-10 — Enrichment layer (models.dev) untuk gap-fill context/maxOutput:** Post-merge, exact-key match dari models.dev (`api.json`) buat nyumbuhin context/maxOutput field yang masih null (3 sumber utama sering incomplete). models.dev BUKAN sumber free-tier (bukan buat discovery), cuma metadata teknis. Exact-match only (ga overwrite existing), append SourceRef. Rationale: reduce "null" value di listing, improve sort-by-context akurasi; best-effort (error → providers tetap, ga jatohin pipeline).
- **2026-06-10 — LLM fallback dual-backend (ANTHROPIC_API_KEY / CLAUDE_CODE_OAUTH_TOKEN):** Kalau sumber unstructured (freellm HTML / cheahjs markdown) gagal regex sanity floor (markup drift), re-fetch + re-parse via LLM (Claude Haiku, verbatim-only prompt, structured JSON output). Dual backend: (1) raw `ANTHROPIC_API_KEY` (API billing per-token), (2) headless `claude` CLI via `CLAUDE_CODE_OAUTH_TOKEN` OR lokal Ray subscription (kuota Max, bukan API billing). Aktif hanya kalau salah satu ada, otherwise fallback OFF (sync jalan normal). Hasil LLM tetap lewat sanity floor + smoke + diff guard. Rationale: automation rescue untuk markup drift (common risk saat HTML-dependent sumber); dual backend akomodasi CI (ga ada cred) + lokal Ray (subscription); cost-aware (billing + quota tradeoff).
- **2026-06-10 — Rolling baselines (data/source-baselines.json):** Auto-recalibrate tiap sync sukses, store last-known-good per sumber (provider count, model count, sanity metric). Guard diff >25% → block push, manual review. Rationale: early warning untuk catastrophic data loss / sumber collapse; audit trail buat correlation saat sumber jatuh.

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
