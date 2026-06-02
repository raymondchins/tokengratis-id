# PRD — tokengratis.id

> Directory free tier & free credits API LLM, di-aggregate otomatis dari sumber yang udah dipercaya komunitas. Audience Indonesia. Social/branding project, bukan startup.
>
> **⚠️ Update 2026-06-01 (lihat docs/log.md):** Schema & scope direvisi setelah validasi sumber. Anchor data = `mnfst/awesome-free-llm-apis` (`data.json`). Field `akses Indonesia` / `butuh CC` / `butuh HP` **DIBUANG** — ga ada sumber yang track terstruktur (→ "Unknown" bertaburan = UI jelek). Info itu kalau ada tetep tampil sebagai teks `description`. Bagian di bawah yang nyebut field/filter/sumber itu = historis; yang berlaku = `lib/types.ts` + CLAUDE.md.

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

## 5. Search & filter (REVISED — implemented)

**Search:** by nama provider atau nama/id model.

**Filter:**

- Kategori provider: `Provider API` / `Inference`
- Modality (facet, di-derive dari model): Text / Vision / Image / Audio / Video / Code / Embeddings / Reranking — cuma yang ada di data yang muncul.

_(Filter lama: akses-Indonesia / no-CC / no-HP / tipe-offer / API-tersedia → DIBUANG. Sumber ga track field-nya terstruktur.)_

---

## 6. Field per listing (REVISED — schema canonical = `lib/types.ts`)

**Provider:** name · category (`provider_api`/`inference_provider`) · country + flag (HQ, BUKAN akses) · url (halaman API key) · baseUrl · **description** (teks apa adanya dari sumber — sering memuat catatan "no credit card"/expiry/region) · modalities (facet) · modelCount · maxContext · **models[]** · source (nama+link) · syncedAt + sourceUpdatedAt.

**Model:** id · name · context · maxOutput · modality · rateLimit.

Semua field di atas BENERAN ada di sumber → **ga ada "Unknown"**. Field yang absent (mis. context ga ditulis) → render "—" / ga ditampilin, bukan kolom "Unknown". Info CC/HP/region yang ga terstruktur **tetap utuh** di `description`.

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

## 9. Framing Indonesia (REVISED — descoped)

Status akses-per-provider dari Indonesia **DIBUANG** sebagai field/badge — ZERO sumber yang track-nya terstruktur, jadi semua bakal jadi ❓ "belum dikonfirmasi" (lawan prinsip "ga nampilin yang nebak"). 

"Indonesia-first" sekarang = **audience & antarmuka Bahasa Indonesia**, bukan klaim filtering akses. Kalau suatu provider punya region block yang eksplisit di sumber (mis. Gemini "unavailable in EU/UK"), itu muncul apa adanya di `description`. Kalau nanti mau hidupin sinyal akses ID lagi → harus lewat layer editorial manual (lihat keputusan di docs/log.md).

---

## 10. Sumber data (REVISED — validated 2026-06-01)

**Anchor (live):** `github.com/mnfst/awesome-free-llm-apis` — satu-satunya yang punya **JSON bersih** (`data.json`, ~24 provider, model-level lengkap, maintained). Di-ingest langsung via `scripts/sync.mjs`.

**Cross-ref (markdown only — belum di-ingest, butuh scraping):** cheahjs/free-llm-api-resources, amardeeplakshkar/awesome-free-llm-apis, aicredits.dev (llms.txt, scope startup-credits lebih luas).

Verdict riset: CC-required / phone-required / akses-Indonesia **ga pernah** jadi field terstruktur di sumber manapun → ga di-model. Yang reliable: provider, model, context, modality, rate limit, signup url.

---

## 11. Tech (ringan aja)

- **Frontend:** Next.js + Tailwind, static/ISR (rebuild tiap malam).
- **Data:** simpan sebagai file di repo (JSON/MDX). **Belum perlu database** buat v1 — datanya read-only & di-generate ulang tiap build.
- **Penjadwalan:** GitHub Actions atau Vercel Cron buat trigger sync + rebuild harian.
- **Hosting:** Vercel.
- **Desain (REVISED):** clean **light / paper / neutral** ala getaiperks.com. bg paper `#f1f0e8` · card putih · text `#11181c` · tombol pure black · accent hijau+ungu. Heading Georgia serif, body Inter. (Oren `#dc4f1c` di-pause, gampang dibalikin di `globals.css`.)

Sengaja tanpa DB, tanpa auth, tanpa backend kompleks — biar maintenance nyaris nol. One exception: `/api/subscribe` (stateless Resend email contact add for newsletter signup — env `RESEND_API_KEY` + `RESEND_AUDIENCE_ID`).

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
