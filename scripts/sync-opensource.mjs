// Pipeline sync "Proyek Open Source Indonesia" — tokengratis.id.
// Fetches repo list from IndopenSource/awesome-indonesia, resolves metadata
// via GitHub REST API per-repo (bounded concurrency), normalises ke schema
// OpenSourceProject, writes data/opensource.json. Idempotent + re-runnable.
//
//   node scripts/sync-opensource.mjs
//   npm run sync:opensource
//
// Sumber:
//   1. IndopenSource/awesome-indonesia repos.json  (kurasi — array "owner/repo")
//   2. GitHub REST API /repos/{owner}/{repo}        (metadata live)
//
// Anti-halusinasi: tiap field BENERAN ada di GitHub API response. Field null
// kalau sumber kosong/tidak tersedia. JANGAN infer/nebak field yang ga ada.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "opensource.json");

const REPOS_URL =
  "https://raw.githubusercontent.com/IndopenSource/awesome-indonesia/main/repos.json";

const GH_API_BASE = "https://api.github.com/repos";

// Bounded concurrency: turunkan request rate ke GitHub API biar ga kena secondary
// rate-limit. 6-8 concurrent requests = sweet spot untuk 39 repos.
const CONCURRENCY = 7;

// Timeout per request (ms)
const TIMEOUT_MS = 15_000;

// ── Auth headers ────────────────────────────────────────────────────────────
function makeHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "tokengratis-id-sync",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    console.warn(
      "  ⚠ Tidak ada GITHUB_TOKEN/GITHUB_PAT — mungkin kena rate-limit (60 req/jam unauthenticated).",
    );
  }
  return headers;
}

// ── Bounded concurrent pool ─────────────────────────────────────────────────
/**
 * Jalankan array fungsi async dengan max `limit` concurrent tasks.
 * Mirip p-limit tapi tanpa deps — cukup buat 39 items.
 * @template T
 * @param {Array<() => Promise<T>>} fns
 * @param {number} limit
 * @returns {Promise<Array<T | null>>}
 */
async function poolAll(fns, limit) {
  const results = new Array(fns.length).fill(null);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < fns.length) {
      const i = nextIdx++;
      results[i] = await fns[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, fns.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ── Fetch satu repo dari GitHub API ────────────────────────────────────────
/**
 * Fetch metadata satu repo. Return null kalau 404/403/error (repo dihapus /
 * renamed / private → skip bukan throw supaya satu repo ga jatohin pipeline.
 * @param {string} ownerRepo  "owner/repo"
 * @param {Record<string,string>} headers
 * @returns {Promise<Object|null>}
 */
async function fetchRepo(ownerRepo, headers) {
  const url = `${GH_API_BASE}/${ownerRepo}`;
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404 || res.status === 403) {
      console.warn(`  ⚠ SKIP ${ownerRepo}: HTTP ${res.status}`);
      return null;
    }
    if (!res.ok) {
      console.warn(`  ⚠ SKIP ${ownerRepo}: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`  ⚠ SKIP ${ownerRepo}: ${e.message}`);
    return null;
  }
}

// ── Normalise GitHub API response → OpenSourceProject ──────────────────────
/**
 * Petakan response GitHub REST API ke skema OpenSourceProject (lib/opensource-types.ts).
 * Anti-halusinasi: CUMA map field yang BENERAN ada di response. Field kosong → null.
 * @param {Object} r  raw GitHub API /repos/{owner}/{repo} response
 * @returns {import('../lib/opensource-types').OpenSourceProject}
 */
function normalise(r) {
  // license.spdx_id mapping: "NOASSERTION" / "NONE" / "" / null → null
  let license = r.license?.spdx_id ?? null;
  if (!license || license === "NOASSERTION" || license === "NONE") {
    license = null;
  }

  return {
    slug: (r.full_name || "").toLowerCase(),
    fullName: r.full_name,
    name: r.name,
    owner: r.owner?.login ?? "",
    ownerUrl: r.owner?.html_url ?? "",
    ownerAvatar: r.owner?.avatar_url || null,
    url: r.html_url,
    homepage: r.homepage && r.homepage.trim() ? r.homepage.trim() : null,
    description:
      r.description && r.description.trim() ? r.description.trim() : null,
    language: r.language || null,
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    openIssues: r.open_issues_count ?? 0,
    license,
    topics: Array.isArray(r.topics) ? r.topics : [],
    archived: !!r.archived,
    pushedAt: r.pushed_at,
    createdAt: r.created_at || null,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const now = new Date().toISOString();
  console.log(`\n[sync-opensource] start  ${now}`);

  // 1. Fetch repos.json → array of "owner/repo" slugs
  console.log(`\n· Fetching slug list dari ${REPOS_URL} …`);
  let slugs;
  try {
    const res = await fetch(REPOS_URL, {
      headers: { "User-Agent": "tokengratis-id-sync" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    slugs = await res.json();
  } catch (e) {
    console.error(`✗ Gagal fetch repos.json: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(slugs) || slugs.length === 0) {
    console.error("✗ repos.json kosong atau bukan array — abort.");
    process.exit(1);
  }
  console.log(`  ✓ ${slugs.length} slug didapat dari IndopenSource/awesome-indonesia`);

  // 2. Fetch semua repo dari GitHub API (bounded concurrency = CONCURRENCY)
  const headers = makeHeaders();
  console.log(`\n· Fetching ${slugs.length} repo dari GitHub API (concurrency=${CONCURRENCY}) …`);

  const fns = slugs.map((slug) => () => fetchRepo(slug, headers));
  const rawResults = await poolAll(fns, CONCURRENCY);

  // 3. Filter null (skipped) + normalise
  const skipped = rawResults.filter((r) => r === null).length;
  const validRaw = rawResults.filter((r) => r !== null);

  console.log(
    `  ✓ Fetched ${validRaw.length} repo OK, ${skipped} di-skip (404/403/error)`,
  );

  // SANITY FLOOR: tolak kalau lebih dari 50% repo gagal
  const floor = Math.ceil(slugs.length * 0.5);
  if (validRaw.length < floor) {
    console.error(
      `✗ Sanity floor gagal: ${validRaw.length}/${slugs.length} repo berhasil, butuh ≥${floor}. Cek koneksi + GitHub API rate-limit. Output TIDAK ditulis.`,
    );
    process.exit(1);
  }

  const projects = validRaw.map(normalise);

  // 4. Sort by stars DESC, tie-break pushedAt DESC
  projects.sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    return (b.pushedAt || "").localeCompare(a.pushedAt || "");
  });

  // 5. Build OpenSourceData wrapper
  const syncedAt = new Date().toISOString();
  /** @type {import('../lib/opensource-types').OpenSourceData} */
  const output = {
    projects,
    sources: [
      {
        name: "IndopenSource/awesome-indonesia",
        url: "https://github.com/IndopenSource/awesome-indonesia",
        syncedAt,
      },
      {
        name: "GitHub API",
        url: "https://docs.github.com/en/rest/repos/repos#get-a-repository",
        syncedAt,
      },
    ],
    syncedAt,
    count: projects.length,
  };

  // 6. Tulis output
  writeFileSync(OUT, JSON.stringify(output, null, 2) + "\n");

  // 7. Summary
  const totalStars = projects.reduce((a, p) => a + p.stars, 0);
  const top3 = projects
    .slice(0, 3)
    .map((p) => `${p.fullName} (★${p.stars.toLocaleString()})`)
    .join(", ");

  console.log(`\n✓ sync-opensource selesai:`);
  console.log(`  · Slugs fetched  : ${slugs.length}`);
  console.log(`  · Repos OK       : ${projects.length}`);
  console.log(`  · Repos skipped  : ${skipped}`);
  console.log(`  · Total stars    : ${totalStars.toLocaleString()}`);
  console.log(`  · Top 3 by stars : ${top3}`);
  console.log(`  · Output         : data/opensource.json (${projects.length} projects)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
