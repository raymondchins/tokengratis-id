# tokengratis.id — Project Instructions

> **Auto-loaded every Claude Code session in this repo.**
>
> Universal rules + working principles live at `~/.claude/CLAUDE.md` (auto-loaded baseline) and `~/.claude/playbook/` (on-demand reference). This file = project-specific only.

## Read on session start

1. `~/.claude/CLAUDE.md` (auto-loaded — baseline rules).
2. This file (auto-loaded — project specifics).
3. `docs/PRD.md` (the spec — read before any feature work).
4. `docs/STATE.md` (on-demand — current state, phase, sources wired, blockers).

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
| Backend | **NONE** — no server actions, no API yang nyimpen state, no auth |
| Pipeline | `scripts/sync.mjs` (`npm run sync`) → fetch mnfst `data.json` → normalize → tulis `data/providers.json`. Idempotent. |
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

- **Canonical:** https://tokengratis.id (domain udah disiapin Ray — attach di Vercel)
- **Vercel fallback:** https://tokengratis-id.vercel.app

## Data sources (PRD §10)

**Anchor (live):** `github.com/mnfst/awesome-free-llm-apis` — satu-satunya sumber free-LLM-API dengan **JSON bersih** (`data.json`), ~24 provider, data level-model lengkap (context, modality, rate limit), maintained aktif. Sync via `scripts/sync.mjs`.

**Cross-ref (markdown only — belum di-ingest):** cheahjs/free-llm-api-resources, amardeeplakshkar/awesome-free-llm-apis, aicredits.dev. Butuh scraping; tambah belakangan kalau perlu.

## Listing fields (schema = `lib/types.ts`)

**Provider:** slug · name · category (`provider_api`/`inference_provider`) · country+flag (HQ, BUKAN akses) · url (API key) · baseUrl · **description** (prosa apa adanya, sering memuat catatan CC/expiry/region) · modalities (facet: text/vision/image/audio/video/code/embeddings/reranking) · modelCount · maxContext · **models[]** · source · syncedAt · sourceUpdatedAt.
**Model:** id · name · context · maxOutput · modality · rateLimit.

Semua field di atas BENERAN ada di sumber → **zero "Unknown"**. Field absent ga di-render (bukan sel kosong).

## Project-specific anti-patterns

- ❌ Kata "Verified" / klaim "verified by us" di mana pun. → "Synced from [sumber]".
- ❌ Bikin kolom/field yang sumbernya ga nyediain terstruktur (mis. CC/HP/akses-Indonesia) → jadi "Unknown" bertaburan. Info kayak gitu cukup tampil sebagai teks `description` apa adanya.
- ❌ Nambahin DB/auth/backend "biar future-proof". v1 sengaja static. Tahan.
- ❌ Pipeline bikin klaim baru pas sumber berubah. Cukup update + tandai "source updated".

## Testing

No automated tests yet — verify via Vercel preview + click-through. Pipeline harus punya smoke test: parse sumber → assert tiap entry punya `source` + `synced_at`, ga ada field yang di-infer.

## Push pattern

Default: feature branch + PR + Vercel preview (per `~/.claude/CLAUDE.md` push routing rule). UI-only → local preview, no PR. Direct to main ONLY kalau Ray bilang "langsung ke main".
