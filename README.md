# tokengratis.id

Direktori **free tier & free credits API LLM**, di-aggregate otomatis dari sumber komunitas. Audience Indonesia (antarmuka Bahasa Indonesia). Aggregator transparan — **bukan verifier**.

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
- **Extract-or-null:** field yang ga eksplisit di sumber → omit. Dilarang nebak.
- Indonesia = audience + bahasa UI, bukan filter akses (tidak ada sumber yang track terstruktur).

## Struktur

```
app/                    ← Next.js App Router (homepage + /provider/[slug])
app/api/subscribe/      ← Resend newsletter route (dormant, belum di-mount di UI)
components/             ← UI components
lib/types.ts            ← schema Provider + Model (lib/types.ts)
scripts/adapters/       ← mnfst.mjs · freellm.mjs · cheahjs.mjs (3 sumber paralel)
scripts/lib/merge.mjs   ← gap-fill merge by priority
data/                   ← providers.json (di-generate pipeline; read-only)
docs/                   ← PRD, STATE, log, CHANGELOG
```
