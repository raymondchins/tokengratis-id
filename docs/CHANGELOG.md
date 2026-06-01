# tokengratis.id — Changelog

> **APPEND-ONLY.** Use bash `>>` heredoc to add entries. NEVER edit existing entries (git is revision history).
>
> **Format:** `### YYYY-MM-DD — Title (commit \`SHA\`)`. Append directly to this file — no sandbox copy needed (Code tab desktop writes to local NTFS).

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

### 2026-06-01 — Directory v1: light/paper redesign + mnfst data re-architecture

**Trigger / context:** Iterasi desain ke arah getaiperks.com (light/paper, serif, tabel list). Pas implement ketahuan masalah data: schema lama (CC/HP/akses-Indonesia/freeQuota) bikin "Unknown" bertaburan karena ga ada sumber yang track field itu. Riset sumber (3 agent paralel) → pivot.

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
