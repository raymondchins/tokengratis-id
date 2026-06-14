# tokengratis.id — Project Instructions

> Project-specific conventions for working in this repo (handy for both human
> contributors and AI coding assistants). Read alongside `README.md` (setup) and
> `CONTRIBUTING.md` (how to add a source).

## Read first

1. This file — project conventions + the core principle.
2. `docs/PRD.md` — the spec (read before any feature work).
3. `docs/STATE.md` — current state, phase, sources wired, blockers (on demand).

## What this is

Directory **free tier & free credits API LLM**, di-aggregate otomatis dari sumber komunitas. Audience Indonesia (antarmuka Bahasa Indonesia). **Social/branding project, BUKAN startup, BUKAN dimonetisasi.** Optimasi: selalu fresh, jujur, maintenance ~nol.

## CORE PRINCIPLE (non-negotiable — baca PRD §2 & §7)

**Situs ini AGGREGATOR, bukan VERIFIER.**

- JANGAN pakai kata **"Verified"** di mana pun. Pakai **"Synced [tanggal] dari [sumber]"** + link.
- Trust dari **transparansi**, bukan klaim. Tiap data WAJIB tampil: dari mana, di-sync kapan, link sumber asli.
- **Anti-halusinasi = aturan #1.** CUMA model field yang BENERAN ada di sumber. Kalau sumber ga nyediain suatu info secara terstruktur → **JANGAN bikin kolomnya** (jangan ada sel "Unknown" kosong). Info yang kebetulan ada di prosa sumber (mis. "no credit card", expiry, region) ditampilin **apa adanya sebagai teks `description`**, bukan dipaksa jadi boolean palsu.
- **DILARANG** infer/nebak/ngelengkapin field yang ga ada di sumber. (Update 2026-06-01: field `requiresCreditCard`/`requiresPhoneVerification`/`indonesiaAccess` DIBUANG dari schema — ga ada satu sumber pun yang track-nya terstruktur.)
- Mantra: lebih baik **nampilin yang real** daripada bikin kolom yang isinya tebakan.

## Tech stack (locked — sengaja seminimal mungkin, maintenance ~nol)

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router) + TypeScript strict + Tailwind 4 |
| Rendering | Static / ISR — rebuild tiap malam, datanya read-only |
| Data | **`data/providers.json`** (di-generate `scripts/sync.mjs`). **NO database** untuk v1. |
| Backend | **NONE** — no server actions, no API yang nyimpen state, no auth. Kecuali 1 route dormant: Resend newsletter (`app/api/subscribe`) — no DB, no auth, no state-storing backend. |
| Pipeline | `scripts/sync.mjs` (`npm run sync`) → fetch **4 sumber paralel** (JSON + HTML + markdown + live API) via `scripts/adapters/*.mjs` → parse + normalize ke satu schema → merge/dedup gap-fill by priority (`lib/merge.mjs`) → enrich context/maxOutput dari models.dev (`lib/enrich.mjs`) → smoke test → tulis `data/providers.json`. LLM fallback (`lib/llm-fallback.mjs`, Claude Haiku) re-parse sumber unstructured yang drift kalau `ANTHROPIC_API_KEY` ada. Idempotent. |
| Scheduling | GitHub Actions (cron nightly) ATAU Vercel Cron — trigger sync + rebuild |
| Deploy | Vercel auto-deploy on `main` push |

**TIDAK ADA:** DB, auth, admin panel, user accounts, submission form, voting, komentar, monetisasi. (PRD §4 "TIDAK masuk v1".) Jangan bangun infra yang nungguin komunitas.

## Design

Clean, **light / paper / neutral** (terinspirasi getaiperks.com). Palette token di `app/globals.css`:
- bg paper `#f1f0e8` · card putih · text near-black `#11181c` · tombol/selected pure black
- accent hijau (`grass*` — positif/free) + ungu (`grape*` — modality tags)
- **Font:** heading = Georgia serif (tracking −0.02em), body = Inter
- Oren `#dc4f1c` di-PAUSE (mau balikin? ganti `--color-ember` di globals.css)

Layout: floating pill navbar → hero serif + 2 tombol → tabel list langsung (ala getaiperks). Detail token = semantic (`ink`/`ember`/`fog`/`mute`/`grass`/`grape`).

## Live URLs

- **Canonical:** https://tokengratis.id
- **Vercel fallback:** https://tokengratis-id.vercel.app

## Data sources (PRD §10)

**4 sumber LIVE & di-ingest** (tiap satu = 1 adapter di `scripts/adapters/`, jalan paralel; sumber gagal di-skip, ga jatohin pipeline):

1. **`mnfst/awesome-free-llm-apis`** (`mnfst.mjs`) — **JSON bersih** (`data.json`), prioritas #1 buat provider non-openrouter. Data level-model lengkap (context, modality, rate limit). `JSON.parse` doang.
2. **`freellm.net`** (`freellm.mjs`) — **HTML table** server-rendered (`/models/`). Di-parse pakai regex (NO cheerio/browser). Kuat di context + modality.
3. **`cheahjs/free-llm-api-resources`** (`cheahjs.mjs`) — **README markdown** (2 format tabel). Cuma section "Free Providers" (skip trial-credits). Kuat di rate limit presisi.
4. **`openrouter.ai/api/v1/models`** (`openrouter.mjs`) — **JSON live API** (public, no auth). Filter ketat id berakhiran `:free`. Emit cuma 1 provider: `openrouter`, dan **authoritative buat dirinya sendiri** (top SOURCE_PRIORITY + post-merge model list dipangkas ke model yang beneran ada di live API → entri komunitas stale di-drop).

Merge = gap-fill by priority di `scripts/lib/merge.mjs` — tiap adapter cuma mindahin field yang EKSPLISIT ada di sumbernya, merge ga nebak. Provider 0-model di-drop (card kosong = useless).

**Enrichment layer (`scripts/lib/enrich.mjs`):** setelah merge, gap-fill `context`/`maxOutput` model yang masih null dari **models.dev** (`api.json`) — exact key match doang, ga overwrite nilai existing, ambiguous match di-skip. models.dev BUKAN sumber free-tier; dia cuma nyumbang metadata teknis. Provider yang dapet fill di-append SourceRef `models.dev`. Best-effort: error → providers utuh, ga jatohin pipeline.

**LLM fallback (`scripts/lib/llm-fallback.mjs`, Claude Haiku):** kalau sumber UNSTRUCTURED (freellm HTML / cheahjs markdown) gagal sanity floor (markup drift) → re-fetch + re-parse via LLM (verbatim-only prompt + structured output). Aktif kalau `ANTHROPIC_API_KEY` ada (raw API, billing per-token) ATAU `CLAUDE_CODE_OAUTH_TOKEN` di-set / ada `claude` CLI login lokal (headless Claude Code via `npx @anthropic-ai/claude-code -p`, pakai kuota subscription Max). Hasil LLM tetap lewat sanity floor + smoke + diff guard. mnfst & openrouter (JSON bersih) ga butuh fallback.

**Belum di-ingest (markdown, butuh scraping):** amardeeplakshkar/awesome-free-llm-apis, aicredits.dev. Tambah belakangan kalau perlu.

## Listing fields (schema = `lib/types.ts`)

**Provider:** slug · name · category (`provider_api`/`inference_provider`) · country+flag (HQ, BUKAN akses) · url (API key) · baseUrl · **description** (prosa apa adanya, sering memuat catatan CC/expiry/region) · modalities (facet: text/vision/image/audio/video/code/embeddings/reranking) · modelCount · maxContext · **models[]** · sources[] (provenance array — tiap SourceRef: name/url/syncedAt) · syncedAt · sourceUpdatedAt.
**Model:** id · name · context · maxOutput · modality · rateLimit.

Semua field di atas BENERAN ada di sumber → **zero "Unknown"**. Field absent ga di-render (bukan sel kosong).

## Project-specific anti-patterns

- ❌ Kata "Verified" / klaim "verified by us" di mana pun. → "Synced from [sumber]".
- ❌ Bikin kolom/field yang sumbernya ga nyediain terstruktur (mis. CC/HP/akses-Indonesia) → jadi "Unknown" bertaburan. Info kayak gitu cukup tampil sebagai teks `description` apa adanya.
- ❌ Nambahin DB/auth/backend "biar future-proof". v1 sengaja static. Tahan.
- ❌ Pipeline bikin klaim baru pas sumber berubah. Cukup update + tandai "source updated".

## Testing

No automated tests yet — verify via Vercel preview + click-through. Pipeline harus punya smoke test: parse sumber → assert tiap entry punya `source` + `synced_at`, ga ada field yang di-infer.

## Contributing

See `CONTRIBUTING.md` for how to add a data source and the house rules (aggregator-not-verifier, extract-or-null, zero "Unknown"). Open a PR against `main`; CI runs typecheck + build + pipeline self-tests.
