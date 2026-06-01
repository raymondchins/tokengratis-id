# tokengratis.id

Direktori **free tier & free credits AI**, di-aggregate otomatis dari sumber komunitas, di-filter buat akses dari **Indonesia**. Aggregator transparan — **bukan verifier**.

Spec lengkap: [`docs/PRD.md`](docs/PRD.md) · State terkini: [`docs/STATE.md`](docs/STATE.md)

## Stack

Next.js 16 (App Router) + Tailwind v4 · static/ISR · **no DB, no auth, no backend** · data = file JSON di repo, regenerate tiap build via pipeline aggregator (nightly cron).

## Dev

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Prinsip non-negotiable

- **Jangan pakai kata "Verified".** Pakai "Synced [tanggal] dari [sumber]".
- **Extract-or-null:** field yang ga eksplisit di sumber → `unknown`. Dilarang nebak.
- Akses-dari-Indonesia default = ❓ belum dikonfirmasi. ✅ hanya kalau sumber eksplisit.

## Struktur

```
app/            ← Next.js App Router (landing, nanti: /directory, /[provider])
components/     ← UI components (nanti)
lib/types.ts    ← model data Offer (PRD §6)
data/           ← providers.json (di-generate pipeline; read-only)
docs/           ← PRD, STATE, log, CHANGELOG
```
