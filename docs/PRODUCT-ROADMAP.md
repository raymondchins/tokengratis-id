# tokengratis.id — Product Roadmap

> Disusun 2026-07-25 dari riset 5-arah paralel (kompetitor global, pasar developer
> Indonesia, permukaan produk teknis, supply-side free credits, model bisnis +
> regulasi). Semua klaim di sini punya sumber; yang nggak terverifikasi ditandai
> `⚠️ unverified`.
>
> Pelengkap `docs/TRAFFIC-ROADMAP.md` (itu soal **traffic**, ini soal **produk**).
> Prinsip lama tetap mengikat: static SSG, aggregator-bukan-verifier,
> anti-halusinasi, maintenance mendekati nol. Item yang melanggar itu masuk
> skip-list dengan alasan, bukan diam-diam dibuang.

---

## 0. TL;DR

- **Direktori = komoditas.** Ada ≥8 list free-LLM-API yang nyaris identik; 3 di
  antaranya lahir dalam 5 bulan terakhir. `cheahjs` 28.171★, `mnfst` 5.995★.
  Jadi "direktori tapi lebih rapi" bukan posisi yang bisa dipertahankan.
- **Tiga keunggulan tokengratis yang nyata hari ini:** (1) Bahasa Indonesia —
  praktis tanpa lawan, (2) pipeline 4-sumber otomatis tiap malam sementara
  kompetitor besar masih update lewat PR manual, (3) disiplin anti-"Verified"
  saat kompetitor (freellm.net) justru masang badge Verified yang lemah.
- **Gap terbesar bukan data, tapi jarak dari "nemu provider" ke "kodenya jalan
  di production, dan gw tau kalau dia mati".** Itu 3 pekerjaan: **Pilih →
  Pasang → Jaga**. Situs sekarang cuma ngerjain sebagian kecil dari "Pilih".
- **Yang paling mahal buat user Indonesia bukan info, tapi akses bayar.** Pasar
  patungan/reseller (Rp40–80rb/bulan vs Rp350rb resmi, ≥5 platform bersaing)
  adalah bukti willingness-to-pay yang sudah tervalidasi — dan semua solusi yang
  ada sekarang melanggar ToS provider.
- **Gateway/proxy free-tier = TIDAK BOLEH dibangun.** Bukan abu-abu: OpenRouter
  ToS §7.4, Groq Services Agreement §3.2/§6.3, dan Mistral melarang eksplisit;
  plus rate limit Groq itu per-organisasi, jadi satu key dishare rame-rame =
  429 buat semua orang. Gagal secara hukum **dan** secara arsitektur.
- **Jalur startup yang paling kredibel bukan jualan token, tapi jualan
  jembatan bayar** (top-up saldo AI pakai QRIS/IDR) — dan itu harus jadi produk
  terpisah, jangan nempel di brand direktori yang nilainya justru dari
  non-komersial.

---

## 1. Diagnosis — kenapa build sekarang belum cukup

| Gap | Buktinya | Akibat |
|---|---|---|
| **Tidak ada retention loop** | Direktori = kunjungi sekali, bookmark, lupa. Kompetitor nutupin ini pakai blog SEO (freellm.net, getaiperks 40+ artikel) — tanda produk intinya nggak punya alasan balik | Traffic naik ≠ user balik. Semua effort SEO bocor. |
| **User ditinggal di tengah jalan** | Kita kasih nama provider + link. Sisanya (daftar, ambil key, nulis client, atur fallback) dia urus sendiri | Nilai yang kita kasih cuma ~10% dari pekerjaan user |
| **Data "benar tapi mati"** | Kita tau Groq punya free tier; kita nggak tau Groq lagi 429 sekarang, atau kuotanya dipotong minggu lalu | Google potong kuota Gemini 50–80% Des 2025 tanpa pengumuman; Qwen Code matiin free tier Apr 2026; PlanetScale bunuh free tier total. Snapshot semalam nggak cukup. |
| **Sempit ke LLM doang** | Nama "token" ngunci ke inference. Padahal indie ID juga kejeblos di hosting, DB, storage, email | Kita cuma nemenin 1 dari 6 masalah biaya dia |
| **Rate limit free tier sering nggak realistis** | Keluhan riil (Threads, 41 likes): *"sebagian besar punya limit yg terbatas, jdi klo integrate ke IDE, sekali nge prompt aja kadang udh kena limit"* | Listing "gratis" tanpa konteks "cukup buat apa" bisa buang waktu user |

---

## 2. Strategi — tiga pekerjaan + satu sumbu ekspansi

Reposisi dari **"direktori free LLM API"** jadi:

> **Jalan tercepat dari "gw butuh AI di app gw" ke "jalan, gratis, dan gw tau
> kalau dia rusak" — buat developer Indonesia.**

Tiga pekerjaan yang harus dikerjain situs:

1. **PILIH** — bukan tabel 398 model, tapi jawaban. "Butuh vision + 128k + gratis
   + masih nyala" → 3 kandidat, alasannya, trade-off-nya.
2. **PASANG** — keluar dari situs dengan `.env` + snippet yang beneran jalan,
   plus rantai fallback, bukan cuma link ke halaman signup.
3. **JAGA** — kasih tau kalau provider-nya mati, kuotanya dipotong, atau ada
   yang baru gratis. Ini loop retensi yang **belum ada satu kompetitor pun
   yang punya** — dan diff-nya udah kita generate tiap malam di `/changelog`.

Sumbu ekspansi: **dari "token gratis" ke "modal gratis"** — deploy, database,
storage, email, auth, student pack, startup credit. Ini yang Ray minta
("deployment / product / app"). Catatan penting dari riset: **domain ini nggak
punya sumber machine-readable sama sekali** — jadi diperlakukan beda (kurasi,
mingguan, entri sedikit tapi akurat), bukan ditempel ke pipeline nightly.

---

## 3. Roadmap

Effort = hari-kerja solo. Nilai = dampak ke user. Risiko = ToS/maintenance/brand.

### Fase 1 — PASANG: dari list jadi kode jalan
**Effort 4–6 hari · Nilai tinggi · Risiko nol · Rasio value/effort terbaik di seluruh roadmap**

Nol data baru. Murni presentasi di atas `data/providers.json` yang sudah ada
(19 dari 24 provider sudah punya `baseUrl`, mayoritas OpenAI-compatible).

- **Generator setup per provider** — pilih provider → dapat `.env` + snippet
  siap-tempel untuk: OpenAI SDK (Node/Python), Vercel AI SDK, LangChain, `curl`.
  Karena baca data live, otomatis ikut fresh tiap sync.
- **Wizard "model apa buat gw"** — filter client-side atas field yang sudah ada
  (`modalities`, `maxContext`, `rateLimit`). Aman anti-halusinasi karena cuma
  memotong field riil, nggak nambah klaim.
- **Resep rantai fallback** — generate konfigurasi fallback (array Vercel AI SDK
  / `config.yaml` LiteLLM) dari 3 provider teratas per kebutuhan. Ini jawaban
  jujur atas keluhan rate-limit: bukan "pake yang ini", tapi "pake tiga ini
  berurutan". *(Generate config-nya boleh; hosting proxy-nya nggak — lihat §5.)*
- **Halaman "5 menit dari nol ke token pertama"** — satu alur, satu provider
  rekomendasi, dalam Bahasa Indonesia.

### Fase 2 — JAGA: loop retensi
**Effort 2–3 hari · Nilai tinggi · Risiko nol · Whitespace kompetitif paling bersih**

Diff nightly sudah ada (`/changelog` + `scripts/lib/diff-guard.mjs`). Yang kurang
cuma saluran keluarnya.

- **Channel Telegram + bot** — post otomatis tiap ada model/provider baru atau
  kuota berubah. **Tanpa DB sama sekali**: Telegram yang nyimpen daftar
  subscriber, kita cuma pegang bot token + chat_id. Bot API gratis tanpa batas
  praktis. Ini mekanisme paling murah yang ada.
- **RSS/Atom** — artefak statis dari diff yang sama. Sekalian ke-index feed
  reader + agen AI.
- **Email digest via Resend** — route `app/api/subscribe` sudah ada tapi dormant.
  Daftar kontak disimpan di Audiences-nya Resend, jadi aturan no-DB tetap utuh.
  Free tier 3.000 email/bulan, cukup jauh.

> Alasan ini prioritas tinggi: perubahan free tier terjadi diam-diam dan sering
> (Gemini −50–80%, Cerebras, Z.ai kasih expiry, Qwen mati, PlanetScale mati).
> Isu "Cerebras Changing Free Plan" dilaporkan manual di repo cheahjs **dan**
> mnfst di minggu yang sama. Nggak ada satu pun yang nyediain feed-nya.

### Fase 3 — JAGA: status hidup (jujur, bukan "Verified")
**Effort 4–6 hari · Nilai tinggi · Risiko: maintenance, bukan legal**

Ping 8–10 provider terpopuler tiap 30–60 menit dari GitHub Actions (pola Upptime,
16k★, biaya $0 di repo publik), tampilkan status + latency + waktu ukur.

- **Framing wajib** — ini satu-satunya pengecualian terdokumentasi dari aturan
  "aggregator bukan verifier", dan bentuknya **pengukuran**, bukan klaim:
  ✅ `Ping terakhir 12 menit lalu: 200 OK, 340 ms (runner GitHub, US-East)`
  ❌ `Verified` / `Terverifikasi` / `Aktif` tanpa waktu & lokasi.
- **Pajak maintenance jujur:** butuh akun + API key sendiri per provider,
  disimpan sebagai GH secret. Key bisa dicabut, skema auth bisa berubah.
  Karena itu **scope 8–10 provider, bukan 24**.
- **Batas teknis:** runner GitHub gratis nggak bisa dipilih region-nya (Azure
  US/EU). Kalau mau angka latency dari Indonesia beneran, perlu self-hosted
  runner di VPS Singapura (~$5/bln) — **tunda dulu**, jangan jadi blocker.

### Fase 4 — PASANG: masuk ke tool-nya user
**Effort 5–6 hari · Nilai menengah-tinggi · Risiko nol · Efek distribusi majemuk**

- **MCP server** (`npx tokengratis-mcp`) — Claude Code / Cursor bisa nanya
  direktori langsung dari editor. Jalan di mesin user, fetch JSON statis kita,
  nol backend, nol permukaan ToS baru. Direktori MCP (glama.ai, awesome-mcp)
  lagi jadi kanal discovery aktif — distribusi gratis.
- **CLI** `npx tokengratis` — client tipis atas JSON yang sama.
- **API JSON publik + `llms.txt`** — `llms.txt` sudah ada; formalkan endpoint
  JSON-nya biar builder lain bisa konsumsi (ini juga fondasi buat Tesis B di §6).

Precedent: `mnfst` sudah ngirim **Claude Skill** di repo-nya, `models.dev`
tumbuh justru karena dikonsumsi tool lain (opencode), bukan karena orang datang
ke situsnya. Distribusi lewat integrasi > distribusi lewat kunjungan.

### Fase 5 — Ekspansi: dari "token gratis" ke "modal gratis"
**Effort 8–12 hari · Nilai tinggi buat misi · Risiko: beban kurasi — ini yang harus diakui di depan**

Ini bagian dari permintaan Ray soal deployment/product/app. Temuan riset yang
menentukan desainnya:

> **Nggak ada satu pun sumber machine-readable** untuk hosting/DB/student
> pack/startup credit. Semua cuma halaman marketing HTML. `free-for-dev` (130k★)
> cuma nyimpen *bahwa* ada free tier + link — **angka kuotanya nggak ter-encode**.
> Jadi ini produk **kurasi**, bukan "tambah satu adapter lagi".

Konsekuensi desain:

- **Entity baru** (`Offer`), terpisah dari `Provider`/`Model` di `lib/types.ts` —
  skema LLM sekarang nggak muat buat "10 GB storage" atau "$10.000 credit".
- **Kadens mingguan**, bukan nightly. Item ini berubah beberapa kali setahun.
- **Sedikit tapi benar** — 40–60 entri terkurasi + tanggal cek + link ke
  halaman resmi vendor (**jangan ke situs agregator** — riset nemu agregator
  saling bertentangan: tier Cloudflare versi agregator $5K/$25K/$100K vs halaman
  resmi $10K/$100K/$350K).
- **Field wajib baru: jebakan.** Ini justru nilai utamanya, bukan pelengkap:
  - Vercel Hobby **melarang proyek komersial** (Fair Use) — jebakan paling sering
    kena indie yang side project-nya mulai menghasilkan.
  - Railway & Fly.io **sudah nggak punya free tier** buat pendaftar baru.
  - Supabase pause setelah 7 hari nganggur; Render spin-down 15 menit.
  - AWS Free Tier direstrukturisasi Jul 2025 (kredit $100–200/6 bulan, bukan
    lagi 12 bulan).
  - Oracle Always Free dikabarkan dipotong 4→2 OCPU sekitar Jun 2026 tanpa
    pengumuman (⚠️ unverified, satu sumber).

**Isi awal — 20 item bernilai tertinggi buat indie Indonesia (dari riset supply-side):**

| # | Item | Nilai | Bisa diambil bootstrapped ID? |
|---|---|---|---|
| 1 | Oracle Cloud Always Free | VM ARM permanen + 10 TB egress/bln | ✅ (kartu cuma buat verifikasi) |
| 2 | Cloudflare for Startups **Tier 3** | $10.000 | ✅ eksplisit buat bootstrapped, tanpa VC |
| 3 | NVIDIA Inception | s/d $100K AWS + $100K DGX, gratis | ✅ tapi **wajib badan usaha** (PT Perorangan) |
| 4 | GitHub Student Developer Pack | payung: JetBrains + $200 DO + $100 Azure + domain | ✅ email `.ac.id` biasanya cukup |
| 5 | Microsoft for Startups Founders Hub (self-service) | $1.000 langsung, s/d $5.000 | ✅ tanpa VC — entry point termudah |
| 6 | Cloudflare Workers/Pages/R2/D1 | permanen, R2 egress $0 | ✅ |
| 7 | Groq + Cerebras + AI Studio ditumpuk | inference cepat ~tanpa batas praktis | ✅ tanpa kartu |
| 8 | Supabase / Neon / Turso | full Postgres/SQLite $0 | ✅ |
| 9 | AWS Activate Founders | ~$5.000 | ⚠️ unverified — halaman resmi nggak konfirmasi tier |
| 10–20 | Vercel Hobby (non-komersial), Sentry+PostHog+Axiom+BetterStack, Azure for Students $100, MongoDB M0, DigitalOcean Hatch, Google for Startups $2K, JetBrains Student, Zed BYOK, HubSpot 30%, Midtrans/Xendit sandbox, Stripe Atlas ($500, bukan gratis — pembuka pintu program yang butuh entitas US) | | |

**Yang tegas di luar jangkauan bootstrapped ID:** kredit Anthropic ($25–100K),
OpenAI, Vercel for Startups, dan Linear — semuanya efektif butuh pendanaan
institusional atau kode referral akselerator. Linear malah **nggak punya jalur
apply langsung sama sekali**. Ini justru info berharga: hemat waktu orang dari
ngelamar sesuatu yang mustahil.

### Fase 6 — (Opsional, terpisah) Jembatan bayar IDR
Lihat §6. **Jangan dibangun sebelum Fase 1–4 jalan dan ada audiens terukur.**

---

## 4. Urutan eksekusi yang disarankan

```
Fase 2 (2-3h) → Fase 1 (4-6h) → Fase 4 (5-6h) → Fase 3 (4-6h) → Fase 5 (8-12h)
   retensi        kegunaan        distribusi       kesegaran      ekspansi misi
```

Fase 2 duluan walau nilainya setara Fase 1: paling murah, dan tiap hari tanpa
loop retensi = traffic yang bocor permanen. Fase 5 paling belakang karena dia
satu-satunya yang nambah beban maintenance berulang.

---

## 5. Skip-list (sengaja TIDAK dibangun, dengan alasan)

| Item | Kenapa di-skip |
|---|---|
| **Gateway/proxy free-tier terhosting** ("OpenRouter khusus gratisan") | **Larangan kontraktual eksplisit, bukan abu-abu:** OpenRouter ToS §7.4 (dilarang reselling API access / bikin competing service), Groq Services Agreement §3.2 & §6.3 (dilarang resell/sublicense, key cuma buat Authorized Account Users), Mistral (dilarang transfer key/akun), Gemini API Terms (dilarang bikin yang berkompetisi dengan Gemini API). **Plus gagal secara arsitektur**: rate limit Groq per-organisasi → semua user berbagi satu bucket → 429 berjamaah begitu ada traffic nyata. Dan risikonya bukan cuma fitur ini gagal — bisa hilang akses ke sumber data yang kita pakai sekarang. |
| **Playground pakai key kita** | Key di halaman publik = kescrape dan diperah dalam hitungan hari. (Varian BYOK — user tempel key sendiri, browser-nya langsung ke provider — boleh dicoba kecil, tapi banyak provider blok CORS; fallback realistis = tombol "copy curl".) |
| **Benchmark sendiri** | Bertentangan langsung dengan prinsip inti "aggregator bukan verifier" + biaya riset. Kalau nanti mau skor, satu-satunya jalur bersih = Artificial Analysis Data API dengan atribusi wajib + cek izin redistribusi dulu, dan diperlakukan persis kayak enrichment models.dev (SourceRef, nggak pernah jadi angka first-party). LMArena nggak punya API resmi — jangan discrape. |
| **Badge "Verified"** | Diferensiator freellm.net, tapi secara epistemik lemah (satu panggilan sukses ≠ rate limit riil ≠ tersedia dari Indonesia) dan melanggar aturan #1 repo ini. Fase 3 adalah versi jujurnya. |
| **Reseller akun sharing (ChatGPT Plus/Claude Pro patungan)** | Permintaannya terbukti besar (Rp40–80rb/bln, ≥5 platform), tapi melanggar ToS provider secara telanjang + risiko brand. Pasar ini sudah dilayani; kita nggak perlu jadi yang ke-6. |
| **Iklan display sekarang** | RPM niche tech ID ~Rp20–30rb/1000 views (⚠️ estimasi blog SEO ID). Di traffic sekarang = uang recehan, tapi biaya visual & kepercayaan langsung. Tunda sampai traffic jauh lebih besar. |
| **Sponsored placement di tabel data** | Merusak satu-satunya aset yang bikin situs ini berarti. Kalau suatu saat perlu, harus di section terpisah yang nggak pernah nyentuh urutan data. |
| **Job board / kursus** | Pekerjaan yang beda total (sales, kurikulum, ops), pasar sudah dikuasai Dicoding/Hacktiv8/RevoU, dan bertentangan dengan etos maintenance ~nol. |
| **VS Code extension** | Effort 5–8 hari + maintenance ngikut API churn VS Code, payoff lebih kecil dari CLI+MCP dengan effort separuhnya. Nanti aja. |
| **Startup-credit directory sebagai pipeline otomatis** | Nggak ada sumber terstruktur, sudah rame dikurasi orang (creditforstartups, startup-perks, aicredits.dev), dan berubah kuartalan bukan harian. Masuk Fase 5 sebagai kurasi manual bernilai-Indonesia, bukan sebagai adapter. |

---

## 6. Jalur startup (kalau Ray mau ambil)

Realitas dari riset: **semua komparabel yang benar-benar menghasilkan uang itu
entah (a) duduk di aliran pembayaran/inference dan ambil spread, atau (b) jualan
ke vendor, bukan ke end-user.** OpenRouter ambil 5,5% dari top-up → ~$50 juta
annualized per Mar 2026 (naik dari ~$19 juta akhir 2025, sumber Sacra ⚠️ estimasi
pihak ketiga). G2 ~85% pendapatannya dari langganan vendor. Artificial Analysis
jual lisensi data enterprise. tokengratis hari ini **nggak punya dua-duanya** —
nggak ada akun, nggak ada aliran uang, nggak ada email capture.

### Tesis A — Jembatan bayar IDR (ceiling paling tinggi)
- **Wedge:** developer/mahasiswa ID nggak bisa bayar $20/bln karena nggak punya
  kartu internasional. Pasar gelap membuktikan permintaannya nyata.
- **Bentuk yang legal:** **jasa top-up saldo ke akun milik user sendiri**
  (misal: "isi saldo OpenRouter kamu $10, bayar Rp185rb pakai QRIS") — user tetap
  pegang akun & key-nya sendiri. Ini **bukan** proxy, **bukan** resale API access,
  **bukan** account sharing. Model ini sudah jalan komersial (vccmurah.net,
  markup ~10%) = tervalidasi.
- **Yang bayar:** mahasiswa, indie, agency kecil yang lebih milih bayar Rp
  lewat QRIS daripada berantem sama kartu USD.
- **100 pelanggan pertama:** pembaca tokengratis + komunitas Telegram/Discord AI
  ID + alumni bootcamp.
- **Bantahan terkuat:** margin tipis lawan fee OpenRouter yang sudah 5,5%; kalau
  OpenRouter/kompetitor bermodal nambah QRIS sendiri, wedge-nya hilang semalam.
  Dan pekerjaannya (integrasi pembayaran, support, compliance) beda total dari
  "rawat pipeline sync".

### Tesis B — Lisensi data (risiko rendah, plafon rendah)
Jual akses terstruktur ke dataset free-tier yang pipeline kita hasilkan, ke
builder/agency/peneliti lain. Modal sudah ada (pipeline + histori sync).
**Bantahan terkuat:** pasarnya kecil — realistis satuan sampai belasan pelanggan
B2B, bukan skala konsumen. Bagus sebagai pendapatan tambahan, bukan sebagai
perusahaan.

### Tesis C — Affiliate/referral (paling murah, paling kecil)
Vercel bayar $100 flat per referral Pro; Supabase 10–20% recurring; OpenRouter
20% recurring (⚠️ dari agregator affiliate, bukan dokumen resmi OpenRouter).
Mayoritas provider inference murni **nggak punya** program affiliate.
Aman kalau diungkap terbuka dan nggak pernah mengubah urutan listing.

### Checklist regulasi (kalau uang mulai bergerak — ini yang bunuh bisnis kategori ini)

| Kewajiban | Kapan berlaku | Biaya/effort |
|---|---|---|
| **PT Perorangan** | Begitu mulai nagih sebagai badan usaha (syarat onboarding payment gateway) | PNBP **Rp50.000**, tanpa akta notaris, elektronik via OSS |
| **Ride licensed PJP** (Midtrans/Xendit/DOKU) | Selalu — **jangan bangun rail pembayaran sendiri** | Gratis daftar; pola sama kayak reseller PPOB — nggak butuh lisensi BI sendiri |
| **Closed-loop, float < Rp1 miliar/bulan** | Kalau ada konsep "saldo" | Di bawah ambang = kewajiban lapor saja, bukan lisensi e-money BI. Lewat ambang = lisensi penuh (PBI 20/6/PBI/2018) |
| **Registrasi PSE Komdigi** | Begitu ada akun/pembayaran/transaksi | Gratis via OSS, **tapi penegakan riil**: 25 PSE (termasuk OpenAI & Cloudflare) dapat surat ancaman blokir Jun–Jul 2026 |
| **PPh Final UMKM 0,5%** | Omzet ≤ Rp4,8 M/tahun; per PP 20/2026 permanen untuk PT Perorangan | 0,5% dari omzet bruto, setor bulanan |
| **PPN PMSE ~11%** | Kalau nembus Rp600 juta/tahun atau Rp50 juta/bulan | Tarif efektif ~11% (12% × DPP nilai lain 11/12) |

**Tiga jebakan yang membunuh:** bangun rail pembayaran sendiri, terbitkan
e-money terbuka, atau jualan akun sharing. Hindari ketiganya dan jalurnya
sempit tapi ada.

### Syarat yang harus benar sebelum Tesis A layak dijalankan
1. Ada audiens terukur (Fase 2 & 4 jalan; sekarang bahkan email capture pun belum).
2. **Produk bayar dipisah dari brand direktori** — merek/section berbeda. Aset
   satu-satunya situs ini adalah dipercaya karena non-komersial.
3. Sourcing dari provider yang memang ramah resale (Together/Fireworks) atau
   murni jasa top-up akun user — **bukan** dari OpenRouter (ToS §7.4).
4. Ray siap ambil pekerjaan yang beda: integrasi pembayaran, kontrak provider,
   compliance. Ini bukan lanjutan dari "rawat sync nightly".

Kalau salah satu dari empat itu nggak terpenuhi: tetap jadikan proyek sosial,
tambahin affiliate + mungkin API data berbayar, dan **jangan kejar jalur
gateway/reseller**.

---

## 7. Yang sebenarnya menentukan — distribusi (butuh Ray, bukan kode)

Riset pasar nunjukin audiens paling sakit (mahasiswa + fresh bootcamp grad)
terkonsentrasi di segelintir kanal besar, bukan di long tail:

- **Dicoding** — 1,2 juta+ member (⚠️ klaim dari blog Dicoding sendiri)
- **Web Programming UNPAS (Sandhika Galih)** — ~980 ribu subscriber YouTube
- **Grup Facebook**: PHP Indonesia 51.931 · Forum Java Programmer Indonesia 40.308
- Telegram dev ID (direktori grup ada di `lawrencegs/grup-telegram-developer-id`)
- Threads/X `#buildinpublic` ID — kecil tapi vokal, dan di situlah keluhan
  rate-limit tadi muncul organik

Satu post di kanal utama > 10 halaman SEO baru. Ini konsisten sama kesimpulan
`TRAFFIC-ROADMAP.md`.

---

## 8. Keputusan yang butuh jawaban Ray

1. **Perluas ke "modal gratis" (Fase 5) atau tetap fokus token?** Konsekuensi:
   nama domain "tokengratis" jadi lebih sempit dari produknya, dan ini
   satu-satunya fase yang nambah beban kurasi manual berulang.
2. **Monetisasi: buka atau tetap tutup?** Kalau dibuka, rekomendasi urutannya
   affiliate → API data → (jauh nanti, brand terpisah) jembatan bayar.
   `CLAUDE.md` sekarang bilang "BUKAN dimonetisasi" — kalau berubah, file itu
   harus diupdate biar nggak jadi aturan basi.
3. **Fase 3 (status ping) — terima pajak maintenance-nya?** Butuh 8–10 akun +
   key milik sendiri yang harus dirawat. Ini satu-satunya item BUILD yang
   beneran menambah kerja rutin.

---

## Sumber

Kompetitor: [cheahjs](https://github.com/cheahjs/free-llm-api-resources) ·
[mnfst](https://github.com/mnfst/awesome-free-llm-apis) ·
[freellm.net](https://freellm.net/) · [models.dev](https://models.dev/) ·
[free-for-dev](https://github.com/ripienaar/free-for-dev) ·
[bansos.dev](https://bansos.dev/) · [artificialanalysis.ai](https://artificialanalysis.ai/) ·
[MrFadiAi/free-llm-gateway](https://github.com/MrFadiAi/free-llm-gateway)

ToS: [OpenRouter Terms](https://openrouter.ai/terms) ·
[Groq Services Agreement](https://console.groq.com/docs/legal/services-agreement) ·
[Mistral additional terms](https://legal.mistral.ai/terms/additional-terms) ·
[Gemini API Terms](https://ai.google.dev/gemini-api/terms)

Kredit/free tier: [Cloudflare for Startups](https://www.cloudflare.com/forstartups/) ·
[Anthropic for Startups](https://claude.com/programs/startups) ·
[Vercel Hobby limits](https://vercel.com/docs/limits) ·
[GitHub Student Pack](https://education.github.com/pack) ·
[NVIDIA Inception](https://www.nvidia.com/en-us/startups/)

Regulasi ID: [Komdigi — kewajiban PSE](https://www.komdigi.go.id/berita/siaran-pers/detail/komdigi-tegaskan-kewajiban-pendaftaran-25-pse-lingkup-privat-terima-pemberitahuan) ·
[PBI 20/6/PBI/2018](https://www.bi.go.id/id/publikasi/peraturan/Pages/PBI-200618.aspx) ·
[PPh Final UMKM PP 20/2026](https://www.pajak.go.id/en/node/119950) ·
[PPN PMSE](https://pajak.go.id/en/digitaltax)

Pasar ID: [Threads — keluhan rate limit](https://www.threads.com/@brokariim/post/DUxvz3RifV6/) ·
[OpenAI Help ID — kartu ditolak](https://help.openai.com/id-id/articles/7232916-mengapa-kartu-kredit-saya-ditolak) ·
[Sacra — OpenRouter](https://sacra.com/c/openrouter/)
