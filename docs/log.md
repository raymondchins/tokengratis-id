# tokengratis.id — Build Log & Learnings

> **Append-only.** Numbered learnings + key technical decisions. NEVER renumber existing entries.
>
> **Current state lives in `STATE.md`** (lighter, read more often). This file = the archive.

---

## How to add a learning

1. Append the next-numbered entry at the end.
2. Format:
   ```
   ### N. <Short title>

   **Context:** what triggered this (incident, feature, debug session).

   **Learning:** what we now know.

   **How to apply:** when this pattern recurs, do X.
   ```

---

## Numbered learnings

### 1. Schema harus ngikut apa yang sumber BENERAN punya, bukan apa yang "ideal"

**Context:** PRD awal nge-spec field CC-required / phone-required / akses-Indonesia / freeQuota / offerType. Pas isi data, hampir semua jadi "Unknown" → UI tabel jelek (kolom kosong di mana-mana). Riset 3 sumber utama (cheahjs, mnfst, aicredits) konfirmasi: ZERO sumber yang track field itu secara terstruktur — paling banter ada di prosa.

**Learning:** Mendesain schema dari "apa yang pengen ditampilin" (wishlist) ketabrak realita sumber. Yang reliable cuma: provider, model, context, modality, rate limit, signup url. Field aspirasional yang ga ada sumbernya = "Unknown" generator = anti-pattern UI + lawan prinsip anti-halusinasi.

**How to apply:** Sebelum bikin field/kolom, cek dulu sumber NYEDIAIN data itu terstruktur apa ga. Kalau cuma kadang muncul di prosa → simpan utuh sebagai `description`, JANGAN bikin kolom boolean/tristate yang mayoritas "Unknown". "Drop the column" > "show Unknown".

**Relevansi (data-modeling):** schema follows source reality, not wishlist — berlaku buat aggregator/scraper manapun.

### 2. Cross-source references HARUS keyed by source label, jangan positional/first-match

**Context:** Saat implementasi openrouter authoritative-trim (drop model openrouter dari group mnfst kalau ga ada di live API), code cari "grup pertama yang ada di partialGroups" → ternyata tangkap group mnfst, bukan live API openrouter. Hasil: 19 model openrouter live ke-drop salah. Nyari source reference pakai `partialGroups.indexOf(sourceLabel)` ambil index pertama → itu group mnfst. Fix: capture reference explicitly `partialGroups.findIndex(g => g === sourceLabelToMatch)`.

**Learning:** Kalau multi-source aggregator, cross-reference antar group/source WAJIB by **key/label, bukan positional first-match**. Positional reference brittle, makan waktu debug.

**How to apply:** Saat nyari sumber specific di list partai/groups (model list, provider group, format variant), selalu pakai `.find()` / `.findIndex()` dengan explicit label match, JANGAN `.indexOf()` first occurrence. Apply ke future multi-format sumber juga (kalau cheahjs + amardeeplakshkar keduanya masuk).

**Relevansi (data-aggregation):** keyed reference > positional — berlaku buat parser manapun yang merge multi-format.

### 3. Pilih sumber by machine-readability, bukan popularity

**Context:** cheahjs paling terkenal/aktif tapi markdown-only (butuh scraping rapuh). mnfst (4.7k⭐) punya `data.json` bersih + terstruktur.

**Learning:** Buat aggregator maintenance-nol, sumber dengan JSON/structured output >> sumber populer tapi markdown. Scraping markdown = brittle + maintenance.

**How to apply:** Saat milih sumber data, prioritas: (1) ada JSON/API publik? (2) maintained? (3) coverage. Anchor ke yang structured, sisanya cross-ref belakangan.

---

## Key technical decisions

_(record major architecture / API contract / schema choices with rationale)_

- **2026-06-01 — Anchor data = mnfst `data.json`:** Pilih mnfst/awesome-free-llm-apis sebagai sumber utama (JSON bersih, 24 provider, model-level). Alternatif (cheahjs/amardeeplakshkar = markdown, aicredits = llms.txt prosa) ditunda — butuh parser. Tradeoff: coverage lebih kecil tapi reliability + maintenance ~nol menang.
- **2026-06-01 — Buang field CC/HP/akses-Indonesia:** Ga ada sumber yang track terstruktur → selalu "Unknown". Indonesia-first di-reframe jadi audience/bahasa, bukan klaim filtering akses. Kalau mau hidupin lagi → WAJIB layer editorial manual (lawan maintenance-nol, jadi ditahan).
- **2026-06-01 — Desain pivot ke light/paper neutral (getaiperks-style):** Dari dark/oren brand palette → light paper + Georgia serif + Inter + accent hijau/ungu. Oren di-pause (token-based, revert 1-2 baris). Rationale: ikut UI language getaiperks.com (light/paper editorial).
- **2026-06-10 — Sumber ke-4: openrouter live API + authoritative-for-self:** Pilih openrouter sebagai sumber ke-4 (live API, public, no auth) filter `:free` only. Emit single provider `openrouter`, authoritative buat model list sendiri (post-merge, pangkas ke model beneran live → entri komunitas stale auto-drop nightly). Rationale: live source = freshest, authoritative pattern mencegah staleness dari crowd-sourced entry.
- **2026-06-10 — Enrichment layer (models.dev) untuk gap-fill context/maxOutput:** Post-merge, exact-key match dari models.dev (`api.json`) buat nyumbuhin context/maxOutput field yang masih null (3 sumber utama sering incomplete). models.dev BUKAN sumber free-tier (bukan buat discovery), cuma metadata teknis. Exact-match only (ga overwrite existing), append SourceRef. Rationale: reduce "null" value di listing, improve sort-by-context akurasi; best-effort (error → providers tetap, ga jatohin pipeline).
- **2026-06-10 — LLM fallback dual-backend (ANTHROPIC_API_KEY / CLAUDE_CODE_OAUTH_TOKEN):** Kalau sumber unstructured (freellm HTML / cheahjs markdown) gagal regex sanity floor (markup drift), re-fetch + re-parse via LLM (Claude Haiku, verbatim-only prompt, structured JSON output). Dual backend: (1) raw `ANTHROPIC_API_KEY` (API billing per-token), (2) headless `claude` CLI via `CLAUDE_CODE_OAUTH_TOKEN` atau login `claude` CLI lokal (kuota subscription, bukan API billing). Aktif hanya kalau salah satu ada, otherwise fallback OFF (sync jalan normal). Hasil LLM tetap lewat sanity floor + smoke + diff guard. Rationale: automation rescue untuk markup drift (common risk saat HTML-dependent sumber); dual backend akomodasi CI (ga ada cred) + dev lokal (subscription); cost-aware (billing + quota tradeoff).
- **2026-06-10 — Rolling baselines (data/source-baselines.json):** Auto-recalibrate tiap sync sukses, store last-known-good per sumber (provider count, model count, sanity metric). Guard diff >25% → block push, manual review. Rationale: early warning untuk catastrophic data loss / sumber collapse; audit trail buat correlation saat sumber jatuh.

---

## Update protocol

- **Project-specific learning** → write here as the next-numbered entry.
- **Decision made** → append to Key Technical Decisions with date + rationale.
- **State change** (phase shift, source added/removed, blocker change) → update `STATE.md`, not here.
- WHY 2026-06-18: accept upstream contraction 27→20 providers (force ALLOW_DATA_SHRINK once) — verified 8 providers genuinely delisted by ALL sources 2 days running; mnfst clean JSON confirms not a parse flake. Aggregator mirrors sources; guard was preserving stale entries. Floor kept at 21.
- WHY 2026-07-17: source-expansion scan (31 candidates, adversarial eval) — HOLD, current 4 sources sufficient. All 6 endpoints live; 0 real dupes (audit-dupes clean). Only marginal add = 0xzr/freellmpool (TOML) but real net-new providers = just Pollinations + LongCat (report over-counted; llm7/kilo/opencode/ovh already covered). mnfst anchor stale since 2026-06-15, no clean fresher replacement — lean on openrouter+freellm for freshness. Backlog watch: CYBIRD-D (CN, messy prose), nejib1/Free-LLM. Skip amardeeplakshkar (stale Mar-2026) + aicredits.dev (no model-level data).
- INCIDENT 2026-07-17: nightly sync GAGAL 2 malam (15 & 16 Jul), data live beku di 14 Jul. Root cause = freellm.mjs ga dedup model per-provider (line ~253) → freellm.net kadang render baris dobel → parser over-count 299→618→885 → rolling baseline ratchet ke 885 (floor 442) → freellm asli ~351 di bawah floor → source di-skip tiap malam → 4 provider freellm-only (agnes-ai/chutes-ai/glhf-chat/xai) hilang → snapshot guard blokir push. Parser SEHAT (live parse 351 normal), murni baseline inflated. Fix: (imm) rebase baseline freellm ~351 / manual run allow_data_shrink=true; (durable) dedup model per-provider di freellm.mjs.
- HARDENING 2026-07-19: code-review quick-wins batch (9 fixes, 6-agent parallel review). Dedup model-per-provider added to ALL adapters (cheahjs/mnfst/openrouter) — same class as freellm incident; cheahjs had 2 real dupes (130→128). Baseline growth cap in updateBaselines (Math.min(new, prev*1.5)) so no source's over-count can permanently inflate the floor. Fetch timeouts on mnfst/cheahjs/enrich/llm-fallback (openrouter/freellm already had). Favicon fetch fail now keeps existing on-disk PNG instead of nulling logo. Snapshot prev Array.isArray guard (non-array JSON no longer crashes guard). gapFillModel modality wrapped in cleanModality. LLM re-fetch mirrors adapter UA/Accept headers. Deleted dead DIRECTORY_GRID export. SKIPPED the freeLimit trial-window loosening — it risks overclaiming a trial credit as standing (anti-halusinasi rule #1).
- SIMPLIFY 2026-07-19: dedup batch (2 parallel agents, zero overlap). Frontend: pageNumbers→lib/pagination.ts, shared <Pagination>/<Chip>/<EmptyDataPanel>/<NoResultsPanel>, opensource search svg→SearchIcon (Directory & Opensource clients no longer copy-paste). Pipeline: decodeEntities/textOf→normalize.mjs shared by freellm+cheahjs (FIXES cheahjs mangling &#39;/&nbsp; — preventive, no current data affected), GENERIC_MODELS_PATTERN single-source, countOf helper (3 dup sites), gapFillModel field-loop (cleanModality preserved), byPriorityKey factory, enrich 3 try/catch→1, dead lib/data.ts re-export deleted, ctxNum single-source lib/ctxnum.mjs (TS re-export + normalize.mjs import — dup copy deleted). Sync output identical pre/post (24/400) = behavior-preserving proof. Pending decisions (untouched): NewsletterForm dead code, ts-morph devDep, freellm fetchHtml→fetch.
