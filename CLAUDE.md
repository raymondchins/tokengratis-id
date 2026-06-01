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

Directory **free AI credits & free tier**, di-aggregate otomatis dari sumber komunitas, di-filter buat akses dari Indonesia. **Social/branding project, BUKAN startup, BUKAN dimonetisasi.** Optimasi: selalu fresh, jujur, maintenance ~nol.

## CORE PRINCIPLE (non-negotiable — baca PRD §2 & §7)

**Situs ini AGGREGATOR, bukan VERIFIER.**

- JANGAN pakai kata **"Verified"** di mana pun. Pakai **"Synced [tanggal] dari [sumber]"** + link.
- Trust dari **transparansi**, bukan klaim. Tiap data WAJIB tampil: dari mana, di-sync kapan, link sumber asli.
- **Anti-halusinasi = aturan #1.** Extract-or-null: kalau info ga eksplisit di sumber → isi **"Unknown"** / **"belum dikonfirmasi"**. DILARANG infer/nebak/ngelengkapin.
- Akses-dari-Indonesia default = ❓ **belum dikonfirmasi**. ✅ HANYA kalau sumber eksplisit.
- Mantra: lebih baik **"Unknown" yang jujur** daripada **"No credit card" yang ngarang**.

## Tech stack (locked — sengaja seminimal mungkin, maintenance ~nol)

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router) + TypeScript strict + Tailwind 4 |
| Rendering | Static / ISR — rebuild tiap malam, datanya read-only |
| Data | **File-based di repo** (JSON/MDX). **NO database** untuk v1. |
| Backend | **NONE** — no server actions, no API yang nyimpen state, no auth |
| Pipeline | Script aggregator (fetch → normalize → dedupe → extract opsional → diff → rebuild) |
| Scheduling | GitHub Actions (cron nightly) ATAU Vercel Cron — trigger sync + rebuild |
| Deploy | Vercel auto-deploy on `main` push |

**TIDAK ADA:** DB, auth, admin panel, user accounts, submission form, voting, komentar, monetisasi. (PRD §4 "TIDAK masuk v1".) Jangan bangun infra yang nungguin komunitas.

## Design

Clean, dark, premium. Brand palette Ray: near-black `#0A0807` + burnt orange `#DC4F1C`. Work Sans buat body. Fokus: keterbacaan tabel & filter yang cepet.

## Live URLs

- **Canonical:** https://tokengratis.id (domain udah disiapin Ray — attach di Vercel)
- **Vercel fallback:** https://tokengratis-id.vercel.app

## Data sources (titik awal — PRD §10)

Mulai 2-3 dulu biar pipeline kebukti, baru nambah:

- `github.com/cheahjs/free-llm-api-resources` (paling aktif)
- `github.com/amardeeplakshkar/awesome-free-llm-apis`
- `github.com/mnfst/awesome-free-llm-apis`
- `aicredits.dev` (punya `llms.txt` — machine-readable)

## Listing fields (PRD §6)

Provider+logo · kategori (LLM/Embeddings/Image/Audio/Agent) · tipe offer (free tier permanen / free credits sekali / trial) · jumlah credit/kuota · rate limit · butuh CC? (Yes/No/**Unknown**) · butuh verif HP? (Yes/No/**Unknown**) · API tersedia? · akses Indonesia (✅/⚠️/❓) · expiry · link signup · link docs · **sumber (nama+link)** · **terakhir di-sync**.

Field ga ketemu di sumber → **"Unknown"**, jangan dikosongin diam-diam, jangan ditebak.

## Project-specific anti-patterns

- ❌ Kata "Verified" / klaim "verified by us" di mana pun. → "Synced from [sumber]".
- ❌ Isi field CC/HP/akses-Indonesia tanpa dasar eksplisit dari sumber. Default = Unknown/❓.
- ❌ Nambahin DB/auth/backend "biar future-proof". v1 sengaja static. Tahan.
- ❌ Pipeline bikin klaim baru pas sumber berubah. Cukup update + tandai "source updated".

## Testing

No automated tests yet — verify via Vercel preview + click-through. Pipeline harus punya smoke test: parse sumber → assert tiap entry punya `source` + `synced_at`, ga ada field yang di-infer.

## Push pattern

Default: feature branch + PR + Vercel preview (per `~/.claude/CLAUDE.md` push routing rule). UI-only → local preview, no PR. Direct to main ONLY kalau Ray bilang "langsung ke main".
