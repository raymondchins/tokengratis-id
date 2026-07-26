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
- CLEANUP 2026-07-19: 3 pending decisions executed (Ray ACC). NewsletterForm.tsx deleted (0 consumer; route /api/subscribe tetap dormant, recreate form dari git history kalau newsletter dihidupin). ts-morph dropped dari devDeps (agentmap bawa sendiri 28.0.0, 0 direct import, agentmap verified jalan). freellm fetchHtml hand-rolled https (~45 baris, tanpa timeout) → built-in fetch + UA/Accept + AbortSignal.timeout(20s), live-verified identik 23 provider/347 model.
- TRAFFIC 2026-07-19: SEO/GEO wave shipped (5 impl agents + 4 research agents paralel, riset dulu baru build). Halaman 36→99: +55 /model/[slug] cross-provider (≥2 provider, disclaimer versi-bisa-beda), +5 facet /gratis/{vision,image,code,video,audio} (gated ≥3 provider, text/embeddings/reranking sengaja skip), +/changelog (diff nightly otomatis dari sync.mjs), +llms.txt & llms-full.txt (speculative keep — bukti lemah). Provider pages: title keyword-first, FAQ auto dari data (field absen → pertanyaan skip), BreadcrumbList+ItemList JSON-LD. IndexNow ping wired di sync.mjs (real ping 202). Robots eksplisit allow AI crawlers. Roadmap lengkap + skip-list (400 per-model pages, 276 comparison = scaled-content trap) di docs/TRAFFIC-ROADMAP.md. Distribusi (butuh Ray) = lever terbesar: post kanal utama > Threads listicle > outreach WPU/Kelas Terbuka.
- WHY 2026-07-19: flip primary domain www→apex di Vercel (apex primary, www 308 ke apex) — semua canonical/sitemap/OG/robots nunjuk apex tapi serving-nya di www (apex 307 ke www) = sinyal canonical muter + GSC "Couldnt fetch" sitemap. Fixed via PATCH project domains API. GSC domain-property + TXT DNS verification kepasang hari yang sama (record di Vercel DNS), sitemap 87 URL submitted.
- INCIDENT 2026-07-22: nightly gagal 2 malam LAGI (19 & 20 Jul) — regresi dari cleanup b46f7d0 sendiri. freellm.net 403 ke built-in fetch dari GitHub Actions (WAF fingerprint undici: accept-encoding otomatis dll), https.get lama aman berminggu-minggu dari CI yang sama; lokal (IP residential) dua-duanya jalan = false confidence. Fix: revert fetchHtml ke https.get client (+ socket timeout), komentar JANGAN-modernisasi dipasang di file. Learning: swap HTTP client di adapter WAJIB divalidasi lewat run CI beneran, bukan cuma lokal. Known gap: LLM-fallback re-fetch freellm juga pakai fetch → bakal 403 di CI juga; belum diubah (secondary layer, adapter utama udah fixed).
- WHY 2026-07-25: docs/PRODUCT-ROADMAP.md disusun dari riset 5-agen paralel (kompetitor, pasar ID, permukaan teknis, supply-side kredit, model bisnis+regulasi). Keputusan besar: (a) reposisi dari direktori ke Pilih→Pasang→Jaga karena format direktori sudah komoditas (≥8 clone, cheahjs 28k★) dan tidak punya retention loop; (b) gateway/proxy free-tier DITOLAK permanen — larangan eksplisit di OpenRouter ToS §7.4, Groq SA §3.2/§6.3, Mistral, Gemini Terms, PLUS rate limit Groq per-organisasi bikin shared key 429 berjamaah, jadi gagal legal sekaligus arsitektur; (c) ekspansi ke free tier hosting/DB/startup-credit diperlakukan sebagai KURASI mingguan entity terpisah, bukan adapter nightly, karena riset membuktikan nol sumber machine-readable di domain itu (free-for-dev pun tidak encode angka kuota); (d) jalur startup satu-satunya yang kredibel = jasa top-up saldo IDR ke akun milik user sendiri (bukan proxy/bukan account-sharing), harus brand terpisah karena aset situs ini justru kepercayaan non-komersial.
- SHIP 2026-07-25: Fase 1+2+4+5 roadmap dieksekusi (7 agen paralel, ownership file disjoint, nol tabrakan tulis). BARU: /pilih (wizard model), /fallback (generator rantai multi-provider: Vercel AI SDK/LiteLLM/TS/.env), SetupPanel di tiap /provider/[slug] (5 target snippet, 5/24 provider baseUrl null -> fallback jujur, BUKAN base URL karangan), /modal-gratis + 54 halaman detail (entity Offer terpisah di lib/offer-types.ts, kurasi manual mingguan karena riset buktikan NOL sumber machine-readable di domain ini), /feed.xml RSS, /api/providers + /api/models (CORS terbuka, static), packages/tokengratis (CLI + MCP server stdio JSON-RPC, ZERO dependency, hand-rolled). Halaman 87 -> 143 URL sitemap. Fase 3 (status ping) SENGAJA dilewat: butuh 8-10 API key atas nama Ray, ga bisa didelegasi. Telegram+email di-skip atas permintaan Ray. WHY entity Offer terpisah: skema LLM (context/modality/rateLimit) ga muat buat '10 GB storage'/'$10.000 credit' -> dipaksa satu = kolom kosong bertaburan, persis yang dilarang aturan #1. WHY facets turunan bukan boolean bebas: pola sama kayak Provider.modalities yang di-derive dari string sumber, jadi facet ga bisa jadi tempat buang opini.
- HARDENING 2026-07-25: guard berbasis BENTUK NILAI, bukan jumlah (5 agen paralel). Pemicunya insiden freellm hari ini: kolom ketuker bikin 216/398 model salah selama berminggu-minggu, dan SEMUA guard lama lolos karena semuanya ngukur KUANTITAS (row count, sanity floor, id churn) sementara yang berubah cuma ARTI kolom. Ketahuan gara-gara manusia ngeliat 'context=81' di output CLI — bukan guard. BARU: scripts/lib/shape-guard.mjs (8 aturan ratio-based, fatal cuma kalau sistemik >50% dgn sampel >=20; nangkep bare-int<1000 = signature kolom Score, currency, tanggal, sisa markup/entity, context===rateLimit, modality tak dikenal, URL invalid, all-null collapse=warn). diff-guard dapet Rule 6 field-value churn (context/maxOutput/modality/rateLimit + description/baseUrl/freeLimit/maxContext), null->value dari enrich SENGAJA dikecualikan biar enrichment ga bikin flap. cheahjs map kolom by nama header (dulu 2-td positional). mnfst+openrouter dapet validasi shape + fill-rate guard (openrouter paling rawan: ga punya baseline di source-sanity, jadi hasil 0-model bisa lolos senyap). sync.mjs jalanin checkShape per-sumber DAN di hasil merge; fatal per-sumber = skip sumber itu, fatal di merge = abort tulis + exit 1. Notifikasi nol-setup: workflow udah punya step buka/update GitHub issue on failure (di-reuse, bukan bikin baru), sekarang isinya baca data/sync-report.json. BUKTI end-to-end lawan data asli (c95ee6d pra-fix vs 2f04f70 pasca-fix): shape-guard FATAL ratio 0.63 sample [81,55,52]; diff-guard BLOKIR 62.4% churn context + 41.7% maxContext; data pasca-fix BERSIH (nol false-positive). 94 selftest, semua masuk npm test. WHY ratio+min-sample bukan absolute: guard yang teriak di data bagus bakal dimatiin orang, dan itu lebih buruk daripada ga ada guard.
- WHY 2026-07-27: audit UI/UX (9 agen paralel + ukur DOM live di production) nemu 3 bug scroll horizontal di mobile yang ga ada satu pun ketangkep tsc/build/CI — semuanya cuma keliatan kalau viewport-nya beneran 375. Akar masalahnya SATU pola yang sama: elemen ga bisa nyusut. (a) FilterBar baris mobile 402px di container 343px tanpa flex-wrap; (b) /pilih grid item default `min-width:auto` bikin track ke-resolve ke min-content kartu (379.5px) padahal container 343px — ini yang paling ga obvious, kontennya sendiri cuma butuh 183px; (c) /gratis/[modality] `min-w-[640px]` ke-apply kebalik: aktif di HP, mati di desktop (`md:min-w-0`), padahal sibling header-nya `hidden` jadi keliatan aman — tombol "Lihat" kedorong ke x~657 alias di luar layar, task-blocker beneran. Learning: guard build ga bisa liat layout; bug responsive cuma ketangkep sama pengukuran DOM di viewport target, dan `min-w-[...]` WAJIB di-gate `md:` kalau baris-nya punya layout mobile sendiri — pola yang bener udah ada di OpensourceClient.tsx (min-w cuma di elemen `hidden md:grid`), tinggal ditiru.
