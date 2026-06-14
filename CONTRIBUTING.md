# Contributing — tokengratis.id

Makasih udah mau bantu! Proyek ini **aggregator komunitas non-komersial** — fresh, jujur, maintenance ~nol. Sebelum ngoding, baca dulu yang ini.

## Prinsip non-negotiable (baca dulu)

Situs ini **AGGREGATOR, bukan VERIFIER**. Aturan keras:

1. **Jangan pakai kata "Verified"** di mana pun. Pakai "Synced [tanggal] dari [sumber]".
2. **Extract-or-null.** Cuma tampilin field yang BENERAN eksplisit ada di sumber. Kalau sumber ga track suatu info secara terstruktur → **jangan bikin kolomnya**. Dilarang infer/nebak/ngelengkapin. Zero "Unknown".
3. **Atribusi selalu tampil.** Tiap provider wajib punya `sources[]` (≥1 SourceRef: name + url + syncedAt).

Detail: [`CLAUDE.md`](CLAUDE.md) + [`docs/PRD.md`](docs/PRD.md) §2 & §7.

## Setup

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (gate)
npm test         # pipeline self-tests (offline, no creds needed)
```

Env vars semuanya opsional — copy [`.env.example`](.env.example) → `.env` cuma kalau perlu (LLM fallback / newsletter).

## Nambah sumber data baru

1. Bikin adapter di `scripts/adapters/<sumber>.mjs`. Output = array provider sesuai schema di [`lib/types.ts`](lib/types.ts). **Cuma emit field yang eksplisit ada di sumber** — sisanya biarin `undefined`/`null`.
2. Tiap entry wajib bawa `SourceRef` (name + url + syncedAt).
3. Wire ke [`scripts/sync.mjs`](scripts/sync.mjs): tambah adapter ke daftar fetch paralel.
4. Set prioritas merge di [`scripts/lib/merge.mjs`](scripts/lib/merge.mjs) (`SOURCE_PRIORITY`) — gap-fill by priority, ga overwrite nilai yang udah ada.
5. Sumber gagal harus **di-skip diam-diam**, jangan jatohin pipeline.
6. `npm test && npm run sync` lokal → pastiin smoke + sanity + diff-guard hijau, ga ada "Unknown".

Sumber dengan **JSON/API terstruktur** jauh lebih disukai daripada HTML/markdown (lihat learning #3 di [`docs/log.md`](docs/log.md)).

## Koreksi data

Data salah/stale biasanya karena sumber upstream-nya. Buka **issue "Data correction"** dengan: provider, field yang salah, nilai yang bener, dan **link sumber** yang mendukung. Kita ga nge-edit data manual tanpa sumber (lawan prinsip anti-halusinasi) — fix-nya lewat adapter/sumber.

## PR flow

1. Branch dari `main`.
2. `npm test` + `npm run build` lokal harus hijau.
3. Buka PR ke `main`. CI jalanin typecheck + build + self-tests.
4. Notable change → tambah entry di [`docs/CHANGELOG.md`](docs/CHANGELOG.md); learning baru → [`docs/log.md`](docs/log.md).

Conventional commits dianjurkan: `feat:` / `fix:` / `chore:` / `docs:` / `refactor:`.
