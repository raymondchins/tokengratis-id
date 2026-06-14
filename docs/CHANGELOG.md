# tokengratis.id — Changelog

> **APPEND-ONLY.** Add new entries at the bottom; don't edit existing ones (git is the revision history).
>
> **Format:** `### YYYY-MM-DD — Title (commit \`SHA\`)`.

---

## How to append

```bash
cat >> docs/CHANGELOG.md <<'ENTRY'

### YYYY-MM-DD — Short title (commit `abc1234`)

**Trigger / context:** ...

**Changes:**
- ...

**Test cases (after deploy):**
1. ...

ENTRY

# Verify:
tail -10 docs/CHANGELOG.md
```

---

<!-- First entry below this line. DO NOT delete this comment block — keeps the format reference at top. -->

### 2026-06-01 — Audit fixes: perf + a11y + correctness + security + SEO (P0–P2)

**Trigger:** Full audit (perf / correctness / a11y-seo / code-quality / security). Fixing all tiers.

**Perf:**
- Self-host favicons — `sync.mjs` download ke `public/logos/<slug>.png` (23/24), UI pakai path lokal + `width/height` (no more 24 third-party requests, no CLS, no Google privacy leak).
- Trim client payload — `getListItems()` kirim versi ramping (tanpa models[]/baseUrl/source) + `searchText` precomputed; `filterProviders`/`sortProviders` jalan di ProviderListItem.
- `useMemo` filter+sort di DirectoryClient.

**Correctness:**
- `ctxNum` kenal "B" (miliar) — extract ke `lib/ctxnum.ts`, mirror di sync.mjs (fix mis-sort context).
- Sentinel "—"/"-"/"N/A" context → null (anti-halusinasi); `cleanStr` di sync.
- Smoke test di sync (assert source+syncedAt, no sentinel maxContext).

**Security:**
- URL scheme allowlist (`safeUrl`) buat url/baseUrl di sync (blok javascript:/data:).
- Security headers di `next.config.ts` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).

**A11y:**
- Row-as-link: `aria-label` per row + header `aria-hidden` (pola list-of-links yg bener buat clickable rows).
- Kontras: footer `mute/70`→`mute`/`fog`; icon audio/image digelapin (AA).
- Focus ring jelas (select/chip/pagination/search), pagination `aria-label`/`aria-current`, nav `aria-label`, "+N" aria-label.

**SEO:** `app/sitemap.ts`, `app/robots.ts`, `app/icon.tsx` (favicon), `app/opengraph-image.tsx` (OG image), twitter card di layout; metadata copy disesuaikan (drop klaim akses-Indonesia).

**Code quality:** dedupe `ctxNum` (lib/ctxnum.ts), `SearchIcon` component, `PAGE_SIZE`/`GRID` ke `lib/constants.ts`.

**Test cases:** build 32 route hijau; `npm run sync` → 24 provider + 23 logo + smoke pass; favicon lokal muncul; chip/pagination keyboard-focusable; sitemap.xml & robots.txt ke-serve.

### 2026-06-01 — Directory polish: free-limit, logo asli, sort, modality icons

**Trigger / context:** Iterasi UI/UX lanjutan di atas redesign getaiperks.

**Changes:**
- **Free limit column:** kolom green baru (ganti posisi Context maks) — di-derive ringkas dari `description` sumber (`freeLimitOf` di sync.mjs): "$10 kredit", "5M token", "1M token/hari", "10,000 Neurons/hari", "~28 model free", "Free (permanen)", dst. Context maks pindah ke detail page.
- **Logo provider asli:** `domainOf()` derive registrable domain dari url/baseUrl → favicon (`google.com/s2/favicons?sz=128`). `components/ProviderLogo.tsx` (client) fallback ke flag emoji kalau gagal load. Dipake di tabel + detail.
- **Sort:** dropdown (Paling populer [default] / Context terbesar / Model terbanyak / Nama A–Z) di `lib/data.ts` (`sortProviders` + editorial `POPULARITY` rank, karena sumber ga punya metric popularitas).
- **Modality icon:** beda warna per modality (text=slate, vision=biru, image=hijau, audio=amber, video=rose, code=violet, embeddings=cyan, reranking=pink) — sebelumnya ungu semua, susah dibedain.
- **Filter chip:** pill → `rounded-xl` rectangle (ikut reference), active = subtle gray fill (bukan solid hitam).
- **Align:** tabel `items-start` + `text-left` (kolom flush top-left, ga ngambang).
- **Honesty:** trust row homepage jadi single-source (cuma mnfst yang beneran di-ingest; cheahjs/aicredits di-drop dari klaim). Footer "ga dimonetisasi." dihapus.

**Test cases:**
1. Tabel: logo provider asli muncul (Google/Groq/OpenRouter/dst), fallback flag kalau favicon ga ada.
2. Kolom "Free limit" hijau keisi tiap row, ga ada "Unknown".
3. Dropdown "Urutkan" → ganti urutan (default Paling populer = Gemini dst di atas).
4. Modality icon warna-warni + tooltip hover.
5. Filter chip rounded-rect, `npm run sync` → "✓ Wrote 24 providers".

### 2026-06-01 — Directory v1: light/paper redesign + mnfst data re-architecture

**Trigger / context:** Iterasi desain ke arah getaiperks.com (light/paper, serif, tabel list). Pas implement ketahuan masalah data: schema lama (CC/HP/akses-Indonesia/freeQuota) bikin "Unknown" bertaburan karena ga ada sumber yang track field itu. Riset sumber → pivot.

**Changes:**
- **Desain:** dark/oren → **light/paper/neutral** (token remap `globals.css`). Font: Inter (body) + Georgia serif (heading). Accent hijau (`grass`) + ungu (`grape`). Oren di-pause.
- **Layout:** floating pill navbar (`components/Navbar.tsx`) + hero serif + 2 tombol → tabel list langsung (ala getaiperks). `components/Spark.tsx` icon.
- **Data re-architecture:** anchor pindah ke `mnfst/awesome-free-llm-apis` (`data.json` — satu-satunya JSON bersih). Pipeline `scripts/sync.mjs` (`npm run sync`) → `data/providers.json` (24 provider).
- **Schema (`lib/types.ts`):** `Offer` → `Provider + Model[]`. Buang `requiresCreditCard`/`requiresPhoneVerification`/`indonesiaAccess`/`offerType`/`freeQuota`. Tambah `modalities`/`models[]`/`maxContext`/`baseUrl`/`country`.
- **UI:** tabel kolom real (Provider · Kemampuan · Context maks · Catatan · Aksi). Filter = kategori + modality + search. Detail = tabel model penuh. Zero "Unknown".
- **Docs:** PRD §1/5/6/9/10/11, CLAUDE.md, STATE.md disinkron.
- Hapus dead `components/directory/OfferCard.tsx`.

**Test cases (after deploy):**
1. `/` → hero "24 provider · N model gratis", tabel tanpa "Unknown".
2. Search "gemini"/"qwen", chip "Vision"/"Inference" → filter jalan.
3. Klik "Lihat" → `/provider/[slug]`: tabel model (context/rate limit), base URL, catatan sumber, atribusi.
4. `npm run sync` → "✓ Wrote 24 providers".

### 2026-06-06 — Multi-source aggregation + infra features (2026-06-01 → 2026-06-06)

**Trigger:** Batch of features shipped post-2026-06-01 that were not individually logged.

**Changes:**
- **Multi-source pipeline:** ditambahkan dua adapter (`scripts/adapters/freellm.mjs` HTML regex-parse, `scripts/adapters/cheahjs.mjs` markdown-parse) di samping mnfst. Ketiga sumber jalan paralel, merged/gap-fill by priority di `scripts/lib/merge.mjs`. Provider count naik ke ~26.
- **Nightly cron live:** `.github/workflows/nightly-sync.yml` (cron `0 19 * * *`) auto-commit data + trigger Vercel rebuild. Pipeline jalan otomatis tiap malam.
- **Resend newsletter route:** `app/api/subscribe/route.ts` ditambahkan sebagai server route dormant (belum di-mount di UI). Tidak ada DB/auth/state.
- **Snapshot-diff integrity guards:** pipeline cek diff sebelum commit (skip kalau sama), guard same-count identity check.
- **CI gate:** GitHub Actions build/test gate sebelum push ke main.
- **Analytics paralel:** Cloudflare Analytics + Vercel Analytics jalan bersamaan. Rencana matiin Vercel setelah banding angka stabil.
- **SEO:** JSON-LD structured data (ItemList di homepage, provider detail), canonical + OG tags, `app/sitemap.ts`, `app/robots.ts`.
- **View Transitions API:** navigasi homepage → detail pakai `startViewTransition`.
- **Mobile responsive sweep:** layout tabel + hero + filter chip di-test + di-fix buat small screens.
- **`/directory` route dihapus:** duplikat homepage → di-remove, ItemList JSON-LD dipindah ke homepage.
- **Logo pruning + branded 404:** logo tidak terpakai dibersihkan, not-found page berbranding.
- **Web manifest + apple-icon:** `app/manifest.ts`, `app/apple-icon.tsx`.

**Test cases:**
1. `npm run sync` → ~26 provider, ketiga sumber terhit, smoke pass.
2. Homepage: hero count sesuai live data, tabel terisi dari 3 sumber.
3. Nightly cron: cek GitHub Actions run history → green nightly commit.
4. `/provider/[slug]` → sources[] ditampilkan (multi-sumber tercatat di provenance).
5. Cloudflare + Vercel analytics keduanya tracking pageview.
6. sitemap.xml + robots.txt ke-serve di prod.
7. View Transition mulus saat klik provider → detail.

### 2026-06-06 — Audit fixes: doc sync + label/schema corrections

**Trigger:** Doc audit — align STATE.md / CHANGELOG.md / README.md / PROJECT-README.md / CLAUDE.md ke realitas kode aktual.

**Changes:**
- **"Rate limit" → "Gratis":** label kolom `freeLimit` di UI diubah dari "Rate limit" ke "Gratis" + drop one-time/expiring credit derivation (cuma tampil free permanent/tiered — bukan kredit sekali pakai).
- **Modalities embeddings/reranking:** ditampilkan di filter chip dan modality badge (sebelumnya di-skip UI).
- **Diff-guard same-count identity check:** pipeline tidak commit kalau provider count identik dan tidak ada perubahan field.
- **CI build/test gate:** GitHub Actions jalanin `npm run build` + smoke sebelum auto-push nightly sync.
- **`/directory` route removed:** homepage is the directory; `/directory` path dihapus, ItemList JSON-LD pindah ke homepage root.
- **`sources[]` schema:** field `source` (singular string) diganti `sources[]` (SourceRef array: name/url/syncedAt) — tiap provider catat provenance dari semua adapter yang berkontribusi.
- **Docs synced:** STATE.md (provider count, 3 sumber, cron ✅, schema sources[]), CHANGELOG.md (batch entries ini), README.md (drop Indonesia-filter framing, fix struktur app/), PROJECT-README.md (drop Supabase reference, note route dormant Resend), CLAUDE.md (Backend row carve-out, sources[] di listing fields).

### 2026-06-10 — Pipeline v2: 4 sumber + enrichment + LLM fallback + rolling baselines (commit `2f7a909`)

**Trigger / context:** Sumber community (mnfst/freellm/cheahjs) ga exhaustive buat free-tier LLM; openrouter live API authoritative buat providernya sendiri + models.dev nyumbuhin metadata teknis yg sering missing. Unstructured sumber (HTML/markdown) rawan markup drift → perlu automated fallback re-parse. Data shrinkage risk → rolling baseline auto-guard.

**Changes:**

**Sumber:**
- **Sumber ke-4: openrouter live API** — fetch `openrouter.ai/api/v1/models`, filter `:free` only (public, no auth). Emit single provider `openrouter`, authoritative buat model list (post-merge, pangkas ke model live → stale community entry auto-drop). Adapter di `scripts/adapters/openrouter.mjs`.
- **Enrichment layer (models.dev):** Post-merge, exact-key gap-fill `context`/`maxOutput` dari `api.json` models.dev (cuma metadata teknis, bukan sumber free-tier discovery). Never overwrite existing, append SourceRef, exact-match only. Di `scripts/lib/enrich.mjs` (427 lines). Reduce null-value di listing, improve sort-by-context.
- **LLM fallback (Claude Haiku):** freellm HTML / cheahjs markdown → kalau regex sanity floor fail (markup drift), re-fetch + re-parse via LLM (verbatim-only prompt, structured JSON output). Dual backend: raw `ANTHROPIC_API_KEY` (API billing) OR headless `claude` CLI via `CLAUDE_CODE_OAUTH_TOKEN` + lokal subscription (kuota Max). Off kalau kedua-duanya absent. Hasil tetap lewat sanity + smoke + diff guard. Di `scripts/lib/llm-fallback.mjs` (683 lines).
- **Rolling baseline (data/source-baselines.json):** Auto-recalibrate tiap sync sukses, store provider-count/model-count/sanity per sumber. Guard >25% diff → block push. Early warning catastrophic loss.

**Fixes:**
- **Critical: authoritative-trim openrouter bug** — sebelumnya cari "group pertama di partialGroups" → ambil group mnfst (bukan live API). 19 model openrouter live ke-drop. Fix: capture by-label (find instead of first-match). Lesson appended ke `docs/log.md`.

**CI/Infra:**
- `.github/workflows/nightly-sync.yml` — commit msg updated, env auth fallback (ANTHROPIC_API_KEY + CLAUDE_CODE_OAUTH_TOKEN secrets), `git add data/` (bukan cuma providers.json → include rolling baseline).

**Data delta:**
- providers.json: sync timestamp updated, ~26 provider live + openrouter models fresh.
- source-baselines.json: baru (rolling baseline initialization).

**Test cases (after deploy):**
1. Nightly cron jalan → providers.json + source-baselines.json di-commit.
2. `/provider/openrouter` muncul, model list berisi `:free` saja (150+ model).
3. Sumber lain (anthropic, groq, grok) punya context value dari enrichment (null sebelumnya).
4. Markup drift fallback: edit freellm/cheahjs HTML structure → sync tetap jalan (LLM rescue) kalau `ANTHROPIC_API_KEY` ada.
5. Rolling baseline: baseline mencatat baseline sebelumnya, >25% diff block push.

