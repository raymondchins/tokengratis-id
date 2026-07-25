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
6. `npm test && npm run sync` lokal → pastiin smoke + sanity + diff-guard + shape-guard hijau, ga ada "Unknown".

Sumber dengan **JSON/API terstruktur** jauh lebih disukai daripada HTML/markdown (lihat learning #3 di [`docs/log.md`](docs/log.md)).

### Kolom kebaca salah lebih bahaya daripada kolom gagal kebaca

INCIDENT 2026-07-25: freellm.net nyisipin kolom "Score" dan buang kolom "Max Output". Jumlah kolom tetap 9, jumlah baris tetap normal — parser TETAP "sukses". Yang berubah cuma ARTI tiap kolom: `context` diam-diam keisi angka Score (81, 45, 47…), 216 dari 398 model salah selama berminggu-minggu. Sanity floor (count provider/model), diff guard (count/churn snapshot), dan smoke test SEMUA lolos — semuanya ngukur JUMLAH, ga ada yang ngukur ARTI. Ketahuan cuma karena ada manusia yang ngeliat "context=81" di output CLI.

**Pelajaran buat adapter apapun: parse yang SUKSES tapi salah kolom lebih bahaya daripada parse yang GAGAL — guard berbasis jumlah ga akan pernah nangkep itu.** Kronologi lengkap ada di komentar atas [`scripts/adapters/freellm.mjs`](scripts/adapters/freellm.mjs) dan [`scripts/lib/shape-guard.mjs`](scripts/lib/shape-guard.mjs).

### Aturan keras buat adapter baru/ubahan

- **Cari kolom/field BY NAMA, jangan by posisi/indeks.** Tabel markdown/HTML: baca baris header, petakan label → indeks — copy pola `parseHeaderMap()` di `freellm.mjs` atau `parseTableHeaderMap()` di [`cheahjs.mjs`](scripts/adapters/cheahjs.mjs), jangan bikin dari nol. JSON: validasi key-nya ADA sebelum dibaca, jangan asumsikan posisi/urutan.
- **Field yang adapter ANDALKAN hilang dari sumber → throw.** Jangan diam-diam isi `null`. `sync.mjs` udah toleran kalau satu sumber gagal (skip sumber itu doang; sumber lain + last-known-good tetap jalan), jadi satu sumber absen semalam itu MURAH. Data salah yang KELIHATAN normal itu MAHAL — itu persis kenapa INCIDENT 2026-07-25 nyantol berminggu-minggu.
- **Bedain "kolom emang ilang di sumber" vs "parser-nya yang patah".** Kolom yang beneran udah ga ada lagi di sumber → `null`, dan jelasin di komentar KENAPA null (lihat komentar `maxOutput` di `freellm.mjs`). Struktur berubah total sampe kolom yang kamu andalkan ga ketemu → throw. JANGAN PERNAH backfill field dari kolom tetangga — itu persis mekanisme INCIDENT 2026-07-25.
- **Tambahin blok `--selftest`** di file adapter kamu dan wire ke `npm test` (`package.json` → `scripts.test`). WAJIB ada **regression case buat failure mode yang lagi kamu jaga** — bukan cuma happy path. Ikuti pola `cheahjs.mjs --selftest` test A2 (kolom header dibalik urutannya, tetep kebaca bener by nama) dan A3 (header nama-model hilang → throw, bukan nebak indeks).
- **Adapter baru WAJIB lolos `checkShape()`** dari [`scripts/lib/shape-guard.mjs`](scripts/lib/shape-guard.mjs) — guard ini ngukur BENTUK nilai tiap field (context harus kelihatan kayak "128K"/"1M", bukan angka telanjang < 1000; rate limit harus kelihatan kayak "30 RPM", dst), bukan cuma jumlah baris. `sync.mjs` manggil `checkShape()` dua kali: (1) **per-sumber**, tepat setelah fetch — fatal di sini cuma skip sumber itu (sumber lain + last-known-good tetap jalan); (2) di hasil **merged final** sebelum ditulis — fatal di sini abort SELURUH write, `data/providers.json` tetap di versi lama. Warning (bukan fatal) di kedua tahap cuma di-print, ga pernah blocking — itu buat kasus ambigu (mis. field 100% null: bisa legit sumber ga nyediain, bisa juga parser patah; manusia yang mutusin).

### Cara verifikasi adapter kamu (jalanin sebelum PR)

1. `npm run sync` lokal, bandingin jumlah provider/model hasilnya vs [`data/providers.json`](data/providers.json) yang lagi ke-commit — turun drastis tanpa alasan jelas = curigai kolom ketuker, jangan langsung diterima.
2. Spot-check MINIMAL 3 entry: buka sumber upstream-nya LANGSUNG hari ini, cocokkin context/maxOutput/rateLimit yang ke-parse vs yang beneran tertulis di sana sekarang. Jangan percaya angka cuma karena formatnya kelihatan masuk akal.
3. `npm test` hijau — termasuk selftest baru kamu.

## Data "modal gratis" (`data/offers.json`) — jalur beda

Dataset `Offer` (hosting/DB/storage/startup-credit — schema di [`lib/offer-types.ts`](lib/offer-types.ts)) BUKAN hasil adapter nightly. Riset 2026-07-25 nemu nol sumber machine-readable di domain ini, jadi datanya dikurasi TANGAN, kadens mingguan. Aturannya beda dari data LLM di atas:

- `sources[].url` WAJIB halaman RESMI vendor. Situs agregator DILARANG jadi sumber — riset nemu angka antar-agregator saling kontradiksi (mis. tier Cloudflare versi agregator vs halaman resmi beda jauh).
- Angka (`limits`, `creditValue`) cuma boleh ditulis kalau halaman resmi nulis angka itu persis. Ga nulis = baris itu dikosongin, jangan ditaksir/dibulatkan.
- `checkedAt` per source = kapan halaman itu DIBACA (provenance), bukan klaim "masih benar sekarang" — semantiknya sama kayak `syncedAt` di data LLM. Tetap DILARANG "Verified"/"Terverifikasi".

## Koreksi data

Data LLM (`data/providers.json`) salah/stale biasanya karena sumber upstream-nya. Buka **issue "Data correction"** dengan: provider, field yang salah, nilai yang bener, dan **link sumber** yang mendukung. Kita ga nge-edit data LLM manual tanpa sumber (lawan prinsip anti-halusinasi) — fix-nya lewat adapter/sumber.

Data `Offer` (`data/offers.json`) beda ceritanya — datanya emang kurasi manual, jadi PR yang langsung edit entry itu OK, asal sertakan link halaman resmi vendor yang mendukung perubahan + update `checkedAt`.

## PR flow

1. Branch dari `main`.
2. `npm test` + `npm run build` lokal harus hijau — termasuk `--selftest` adapter baru/ubahan kamu.
3. Buka PR ke `main`. CI jalanin typecheck + build + self-tests.
4. Notable change → tambah entry di [`docs/CHANGELOG.md`](docs/CHANGELOG.md); learning baru → [`docs/log.md`](docs/log.md).

Conventional commits dianjurkan: `feat:` / `fix:` / `chore:` / `docs:` / `refactor:`.
