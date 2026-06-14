# tokengratis.id

Direktori **free tier & free credits API LLM**, di-aggregate otomatis dari sumber komunitas. Audience Indonesia (antarmuka Bahasa Indonesia). Aggregator transparan — **bukan verifier**.

> Live: **https://tokengratis.id** · Spec: [`docs/PRD.md`](docs/PRD.md) · State terkini: [`docs/STATE.md`](docs/STATE.md)

Tiap data nampilin **dari mana** + **di-sync kapan** + link ke sumber aslinya. Ga ada klaim "verified" — trust dari transparansi, bukan klaim.

## Stack

Next.js 16 (App Router, Turbopack) + TypeScript strict + Tailwind v4 · static/SSG · **no DB, no auth, no backend** · data = file JSON di repo, regenerate tiap malam via pipeline aggregator (nightly cron → Vercel rebuild).

## Dev

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm test         # pipeline self-tests (jalan offline, no creds)
```

Env vars semuanya **opsional** — situs build & jalan tanpa satu pun di-set. Copy [`.env.example`](.env.example) → `.env` kalau mau ngaktifin LLM fallback / newsletter route.

### Code navigation — agentmap

Repo ini pakai [**agentmap**](https://www.npmjs.com/package/@raymondchins/agentmap) (devDep) — code-relationship & reuse map buat ngejawab "file apa yang make X", "siapa yang import ini", "fitur Y filenya apa aja", reuse-before-rebuild — tanpa grep manual. Berguna buat human contributor maupun AI coding assistant.

```bash
npm run agentmap -- --any <query>      # auto-route: file / symbol / feature / live content
npm run agentmap -- --relates <path>   # blast radius (siapa yang import path ini)
npm run agentmap -- --find <symbol>    # reuse-before-rebuild
```

## Cara kerja (pipeline aggregator)

`npm run sync` (atau nightly cron) jalanin `scripts/sync.mjs`:

1. **Fetch 4 sumber paralel** via `scripts/adapters/*.mjs` (sumber gagal di-skip, ga jatohin pipeline):
   - `mnfst/awesome-free-llm-apis` — JSON bersih (anchor, prioritas #1)
   - `freellm.net` — HTML table (regex parse)
   - `cheahjs/free-llm-api-resources` — README markdown
   - `openrouter.ai/api/v1/models` — live API publik (filter `:free`)
2. **Merge/gap-fill by priority** (`scripts/lib/merge.mjs`) — tiap adapter cuma mindahin field yang eksplisit ada di sumbernya, merge ga nebak.
3. **Enrich** `context`/`maxOutput` yang masih null dari [models.dev](https://models.dev) (`scripts/lib/enrich.mjs`, exact-match doang, ga overwrite).
4. **LLM fallback** (`scripts/lib/llm-fallback.mjs`) — re-parse sumber unstructured kalau markup drift; aktif hanya kalau `ANTHROPIC_API_KEY` / `CLAUDE_CODE_OAUTH_TOKEN` ada.
5. **Guards** — sanity floor + smoke test + rolling-baseline diff guard (`data/source-baselines.json`) → block push kalau data collapse, last-known-good tetap live.
6. Tulis `data/providers.json`.

Direktori open-source Indonesia di-refresh terpisah via `npm run sync:opensource` (`scripts/sync-opensource.mjs`).

## Prinsip non-negotiable

- **Jangan pakai kata "Verified".** Pakai "Synced [tanggal] dari [sumber]".
- **Extract-or-null:** field yang ga eksplisit di sumber → omit. Dilarang nebak. Zero "Unknown".
- Indonesia = audience + bahasa UI, bukan filter akses (tidak ada sumber yang track terstruktur).

Detail lengkap: [`CLAUDE.md`](CLAUDE.md) + [`docs/PRD.md`](docs/PRD.md).

## Struktur

```
app/                        ← App Router (homepage · /provider/[slug] · /opensource)
app/api/subscribe/          ← Resend newsletter route (dormant, belum di-mount di UI)
components/                 ← UI components
lib/types.ts               ← schema Provider + Model
scripts/sync.mjs           ← pipeline aggregator (npm run sync)
scripts/adapters/          ← mnfst · freellm · cheahjs · openrouter (4 sumber paralel)
scripts/lib/               ← merge · enrich · llm-fallback · diff-guard · source-sanity
scripts/sync-opensource.mjs ← direktori open source Indonesia
data/                      ← providers.json · opensource.json · source-baselines.json (di-generate; read-only)
docs/                      ← PRD, STATE, log, CHANGELOG
```

## Attribution / Sumber data

Yang di-aggregate cuma **fakta** (nama provider, context window, rate limit, signup URL), selalu dengan atribusi + link balik (lihat `components/Footer.tsx` + `sources[]` provenance per provider). Kredit:

| Sumber | Lisensi | Peran |
|---|---|---|
| [mnfst/awesome-free-llm-apis](https://github.com/mnfst/awesome-free-llm-apis) | CC0-1.0 | Anchor source (#1) |
| [cheahjs/free-llm-api-resources](https://github.com/cheahjs/free-llm-api-resources) | no license declared | Cross-ref (fakta only) |
| [freellm.net](https://freellm.net) | website | Cross-ref |
| [openrouter.ai](https://openrouter.ai) | public API | Authoritative untuk `openrouter` |
| [models.dev](https://models.dev) | — | Enrichment metadata teknis |

Detail lisensi/ToS tiap sumber: [`docs/PRD.md` §10](docs/PRD.md). Kalau lo pemilik salah satu sumber dan mau entry-nya diturunin, buka [issue](https://github.com/raymondchins/tokengratis-id/issues).

## Contributing

Lihat [`CONTRIBUTING.md`](CONTRIBUTING.md) — terutama cara nambah sumber data baru (bikin adapter di `scripts/adapters/` → wire ke `scripts/sync.mjs` → set merge priority). PR ke `main`; CI jalanin typecheck + build + pipeline self-tests.

## License

[MIT](LICENSE) © Raymond Chin. Lisensi nutup **kode** proyek ini — data agregat tetap milik sumber masing-masing (lihat Attribution).
