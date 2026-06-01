# PRD — tokengratis.id

> Directory free AI credits & free tier, di-aggregate otomatis dari sumber yang udah dipercaya komunitas, di-filter buat akses dari Indonesia. Social/branding project, bukan startup.

---

## 1. Tujuan

Bikin satu tempat di mana developer, mahasiswa, dan indie builder bisa cepet nemu **resource AI yang bisa dipake gratis buat prototyping** — tanpa harus ngubek 12 halaman docs, Reddit, atau Discord.

Yang bikin beda dari directory lain: **Indonesia-first**. Fokus ke pertanyaan "ini beneran bisa gw akses dari Indonesia ga?" (region block, butuh CC internasional, butuh nomor non-+62).

Ini proyek komunitas / branding. **Bukan** produk yang dimonetisasi, bukan startup. Optimasi utamanya: selalu fresh, jujur, dan maintenance mendekati nol.

---

## 2. Prinsip inti (WAJIB dipegang Claude Code)

**Situs ini AGGREGATOR, bukan VERIFIER.**

Artinya:

- Kita **tidak** ngeklaim "verified by us". Kita kumpulin data dari sumber yang udah maintain manual, lalu tampilin dengan **atribusi + link sumber + waktu sync**.
- Trust dateng dari **transparansi**, bukan dari klaim. User harus selalu bisa lihat: data ini dari mana, terakhir di-sync kapan, dan klik ke sumber aslinya.
- **Anti-halusinasi adalah aturan nomor satu.** Lihat Section 7. Lebih baik field kosong/"unknown" daripada nebak.

---

## 3. Target user

- Developer yang mau prototyping tanpa bayar
- Mahasiswa & peserta hackathon
- Indie hacker / solo builder
- Founder early-stage yang nyari credits

---

## 4. Scope MVP

### Masuk (v1)

1. Halaman directory — list semua provider/offer, bisa di-filter.
2. Halaman detail per provider — semua field (Section 6).
3. Filter & search (Section 5).
4. Pipeline aggregator otomatis yang sync dari sumber tiap malam (Section 8).
5. Label kejujuran data: "Synced [tanggal] dari [sumber]" + link.
6. Framing Indonesia-first (Section 9).

### TIDAK masuk v1 (ditunda sampai ada traffic)

- ❌ Community submission form
- ❌ Voting / reputation / badges / "trusted verifier"
- ❌ Komentar
- ❌ User account / auth
- ❌ Admin panel
- ❌ Monetisasi (sponsored, newsletter, dll)

Alasan: semua itu butuh komunitas yang udah jalan dulu. Hari pertama belum ada. Jangan bangun infra yang nungguin orang.

> Catatan penting: PRD lama gw ada "Verification System (Admin Verified / Community Verified)". **Itu dibuang.** Diganti jadi **"Synced"** karena situs ini fully automated dan ga ada manusia yang verify. Jangan pakai kata "Verified" di mana pun.

---

## 5. Search & filter

**Search:** by nama provider atau nama model.

**Filter (yang paling penting di atas):**

- ✅ Bisa diakses dari Indonesia (lihat aturan label di Section 7 & 9)
- ✅ Ga butuh kartu kredit
- ✅ Ga butuh verifikasi nomor HP
- Kategori: LLM / Embeddings / Image / Audio / Agent
- Tipe offer: Free tier permanen / Free credits (sekali) / Trial
- API tersedia

---

## 6. Field per listing

Setiap offer nampilin:

- Nama provider + logo
- Kategori
- Tipe offer (free tier / free credits / trial)
- Jumlah credit / kuota gratis (kalau ada)
- Rate limit (kalau ada)
- Butuh kartu kredit? (Yes / No / **Unknown**)
- Butuh verifikasi nomor HP? (Yes / No / **Unknown**)
- API tersedia? (Yes / No)
- Region / akses dari Indonesia (Section 9)
- Aturan kadaluarsa (kalau ada)
- Link signup (resmi)
- Link dokumentasi (resmi)
- **Sumber data** (nama + link, misal "cheahjs/free-llm-api-resources")
- **Terakhir di-sync** (tanggal)

Field yang datanya ga ketemu di sumber → tampilkan **"Unknown"**, jangan dikosongin diam-diam dan jangan ditebak.

---

## 7. Aturan kejujuran data (anti-halusinasi)

Ini bagian paling krusial. Pipeline boleh pakai LLM buat extract data dari halaman, **dengan aturan keras:**

1. **Extract-or-null.** Kalau sebuah info ga eksplisit tertulis di sumber, isi **null / "unknown"**. **DILARANG infer, nebak, atau ngelengkapin.**
2. **Simpan kutipan sumber.** Tiap field hasil extract simpan potongan teks asal + URL-nya, biar bisa diaudit.
3. **Sync ≠ assert.** Pas halaman sumber berubah, sistem cukup **update + tandai "source updated"**. JANGAN bikin klaim baru yang ga ada di sumber.
4. **Atribusi selalu tampil.** Tiap data harus kelihatan dari mana asalnya.
5. Field yang sifatnya berubah-ubah & jarang tertulis (CC required, akses Indonesia, verif HP) → kalau ragu, label **"belum dikonfirmasi"**, bukan Yes/No palsu.

Mantra: **lebih baik nampilin "unknown" yang jujur daripada "No credit card" yang ngarang.**

---

## 8. Cara kerja (high-level, ga teknis)

Pipeline jalan otomatis, **tanpa manusia**, dijadwal tiap malam:

1. **Ambil** — tarik data dari daftar sumber (Section 10).
2. **Rapihin** — samain formatnya ke struktur field di Section 6.
3. **Gabung & dedupe** — banyak provider muncul di beberapa sumber; gabung jadi satu entry, simpan semua sumbernya.
4. **Extract** (opsional, kalau perlu detail tambahan) — pakai LLM dengan aturan Section 7.
5. **Cek perubahan** — simpan "sidik jari" tiap halaman sumber; kalau berubah, tandai untuk re-sync.
6. **Build ulang situs** — situs di-generate ulang tiap malam, otomatis fresh.

User ga pernah lihat proses ini. Mereka cuma lihat directory yang selalu update.

---

## 9. Framing Indonesia-first

Ini positioning utama. Buat tiap offer, tampilkan status akses dari Indonesia salah satu dari:

- ✅ **Bisa diakses** — kalau sumber/docs eksplisit ga ada region block & ga butuh CC/nomor luar.
- ⚠️ **Ada syarat** — misal butuh kartu kredit internasional, atau verif nomor HP.
- ❓ **Belum dikonfirmasi** — default kalau ga ada info jelas. (Ini yang paling sering, dan ga apa-apa — jujur.)

Jangan pernah kasih label ✅ tanpa dasar dari sumber. Default-nya ❓.

---

## 10. Sumber data (titik awal)

Sumber yang udah di-maintain komunitas & relatif terstruktur:

- `github.com/cheahjs/free-llm-api-resources` (paling aktif)
- `github.com/amardeeplakshkar/awesome-free-llm-apis`
- `github.com/mnfst/awesome-free-llm-apis`
- `aicredits.dev` (punya `llms.txt` — machine-readable, gampang di-parse)
- Halaman pricing/docs resmi provider yang punya `llms.txt` sendiri

Mulai dari 2-3 sumber dulu biar pipeline kebukti, baru nambah.

---

## 11. Tech (ringan aja)

- **Frontend:** Next.js + Tailwind, static/ISR (rebuild tiap malam).
- **Data:** simpan sebagai file di repo (JSON/MDX). **Belum perlu database** buat v1 — datanya read-only & di-generate ulang tiap build.
- **Penjadwalan:** GitHub Actions atau Vercel Cron buat trigger sync + rebuild harian.
- **Hosting:** Vercel.
- **Desain:** clean, dark, premium. Boleh ikut brand palette gw (near-black `#0A0807` + burnt orange `#DC4F1C`, Work Sans buat body). Fokus ke keterbacaan tabel & filter yang cepet.

Sengaja tanpa DB, tanpa auth, tanpa backend kompleks — biar maintenance nyaris nol.

---

## 12. (Opsional, kalau cepet) sinyal komunitas paling murah

Satu-satunya elemen komunitas yang boleh masuk v1 — **hanya kalau gampang**: tombol per-entry **"Masih works? 👍 / Udah mati 👎"** (anonim, simpan count doang).

Ini buat ngisi info yang mesin ga bisa tau (akses Indonesia real-time). Sifatnya **nambahin**, bukan jadi tulang punggung. Kalau nambah ribet, skip — taro di v2.

---

## 13. Definisi selesai (v1)

- Directory bisa dibuka, di-search, di-filter.
- Tiap entry punya atribusi sumber + tanggal sync + link.
- Pipeline sync jalan otomatis tiap malam, ga butuh tangan.
- Ga ada satu pun klaim yang ga punya sumber.
- Situs fresh tanpa gw harus ngapa-ngapain.

---

## 14. Non-goals (biar fokus)

- Bukan buat menang kategori atau ngalahin GitHub lists — itu sumber kita, bukan musuh.
- Bukan buat dimonetisasi.
- Bukan "verified directory" — kita aggregator yang transparan.
- Bukan butuh komunitas aktif buat berfungsi.
