#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// ============================================================================
//  agentmap — the repo map your coding agent is *forced* to use.
//
//  A ts-morph code-relationship map for TypeScript/JavaScript repos. Unlike
//  one-shot "pack the repo into a prompt" tools, this is a QUERYABLE, RANKED
//  map: PageRank importance (ported from Aider's repo map), Aider-style
//  symbol ranking, a token-budgeted `--map` digest, and a single `--any`
//  router (file → symbol → feature → live git-grep) — wired into the agent
//  loop via a post-commit auto-refresh + a PreToolUse hook.
//
//  Near-zero deps (ts-morph only). Runs in the target repo's cwd.
//  Algorithm credit: Aider's repo map (Apache-2.0) — github.com/Aider-AI/aider
// ============================================================================
import { Project } from "ts-morph";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync, execFileSync } from "node:child_process";

const MAP = ".claude/repomap.json";
const SCHEMA_VERSION = 2;
const sh = (c) => { try { return execSync(c, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; } };

// Live content search for the --any fallback. `git grep` over tracked +
// untracked files (skips gitignored paths like node_modules). Reads DISK, so
// never stale. -F = fixed-string so literals like "bg-[#faf8f2]" aren't regex.
const contentSearch = (q) => {
  try {
    return execFileSync("git", ["grep", "-F", "--untracked", "-n", "-i", "-I", "-e", q, "--", ".", ":!.claude/repomap.json"], { encoding: "utf8" }).trim();
  } catch { return ""; }
};
const currentSha = () => sh("git rev-parse --short HEAD");
const dirtyCount = () =>
  sh("git status --porcelain").split("\n").filter(Boolean).filter((l) => {
    let p = l.slice(3);                                  // strip "XY " status prefix
    if (p.includes(" -> ")) p = p.split(" -> ").pop();   // rename: keep the new path
    p = p.replace(/^"|"$/g, "");                         // unquote space/special paths
    return /\.(ts|tsx|mjs|cjs|jsx|js)$/.test(p);
  }).length;
const tokEst = (s) => Math.ceil((s || "").length / 4); // rough chars/4 estimate

// Feature = first real route segment under app/ (or src/app/), skipping route
// groups (parens), dynamic segments ([id]) and parallel routes (@slot).
function featureOf(path) {
  const m = path.match(/(?:^|.*\/)(?:src\/)?app\/(.+)/);
  if (!m) return null;
  for (const p of m[1].split("/").slice(0, -1)) {
    if (p.startsWith("(") || p.startsWith("[") || p.startsWith("@")) continue;
    return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Personalized PageRank — dependency-free power iteration. Deterministic
// (stable node order, no PRNG). Edges = [{from, to, weight}]. Rank flows
// from→to, so with importer→imported edges, heavily-imported hubs rank high.
// Dangling-node mass + teleport both go to the personalization vector
// (matches Aider's `dangling=personalization`). Returns { node: score }.
// ---------------------------------------------------------------------------
function pagerank(nodes, edges, { personalization = null, damping = 0.85, tol = 1e-6, maxIter = 100 } = {}) {
  const N = nodes.length;
  if (N === 0) return {};
  const idx = new Map(nodes.map((n, i) => [n, i]));
  const outW = new Float64Array(N);
  const adj = Array.from({ length: N }, () => []);
  for (const e of edges) {
    const a = idx.get(e.from), b = idx.get(e.to);
    if (a === undefined || b === undefined || a === b) continue; // skip self-loops
    const w = e.weight > 0 ? e.weight : 1;
    adj[a].push([b, w]); outW[a] += w;
  }
  // teleport vector p (normalized personalization, or uniform)
  const p = new Float64Array(N);
  if (personalization) {
    let s = 0;
    for (const [k, v] of Object.entries(personalization)) {
      const i = idx.get(k);
      if (i !== undefined && v > 0) { p[i] = v; s += v; }
    }
    if (s === 0) p.fill(1 / N); else for (let i = 0; i < N; i++) p[i] /= s;
  } else p.fill(1 / N);
  let r = Float64Array.from(p);
  for (let iter = 0; iter < maxIter; iter++) {
    let dangling = 0;
    for (let i = 0; i < N; i++) if (outW[i] === 0) dangling += r[i];
    const next = new Float64Array(N);
    for (let i = 0; i < N; i++) next[i] = (1 - damping) * p[i] + damping * dangling * p[i];
    for (let i = 0; i < N; i++) {
      if (outW[i] === 0) continue;
      const ri = damping * r[i];
      for (const [j, w] of adj[i]) next[j] += ri * (w / outW[i]);
    }
    let diff = 0;
    for (let i = 0; i < N; i++) diff += Math.abs(next[i] - r[i]);
    r = next;
    if (diff < tol) break;
  }
  const out = {};
  for (let i = 0; i < N; i++) out[nodes[i]] = r[i];
  return out;
}

// Aider-style identifier edge-weight multipliers. `mentioned` = focus/query
// idents (boosted). Rarity is approximated by the >5-definers penalty.
function identMul(ident, defineCount, mentioned) {
  let mul = 1.0;
  const hasAlpha = /[a-zA-Z]/.test(ident);
  const isSnake = ident.includes("_") && hasAlpha;
  const isKebab = ident.includes("-") && hasAlpha;
  const isCamel = /[a-z]/.test(ident) && /[A-Z]/.test(ident);
  if (mentioned && mentioned.has(ident)) mul *= 10;
  if ((isSnake || isKebab || isCamel) && ident.length >= 8) mul *= 10;
  if (ident.startsWith("_")) mul *= 0.1;
  if (defineCount > 5) mul *= 0.1;
  return mul;
}

// Construct a ts-morph Project robustly: use tsconfig.json when present + valid;
// else (missing / malformed / solution-style references that index 0 files) fall
// back to broad source globs so the tool degrades gracefully instead of crashing.
function makeProject() {
  let project;
  if (existsSync("tsconfig.json")) {
    try { project = new Project({ tsConfigFilePath: "tsconfig.json" }); }
    catch { project = new Project({ compilerOptions: { allowJs: true } }); }
  } else {
    project = new Project({ compilerOptions: { allowJs: true } });
  }
  // tsconfig `include` usually omits build/pipeline scripts — add by path.
  project.addSourceFilesAtPaths(["scripts/**/*.mjs", "scripts/**/*.cjs", "scripts/**/*.js", "*.mjs", "*.cjs"]);
  // Fallback: nothing indexed (no / empty / references-only tsconfig) → broad globs.
  if (project.getSourceFiles().length === 0)
    project.addSourceFilesAtPaths([
      "src/**/*.{ts,tsx,js,jsx}", "app/**/*.{ts,tsx,js,jsx}",
      "components/**/*.{ts,tsx,js,jsx}", "lib/**/*.{ts,tsx,js,jsx}",
      "pages/**/*.{ts,tsx,js,jsx}", "*.{ts,tsx,js,jsx}",
    ]);
  return project;
}

// ---------------------------------------------------------------------------
// build() — parse the repo, extract file imports/exports (+ which named
// symbols cross each edge), compute file PageRank, run the Aider-style
// identifier graph to rank individual symbols, and persist repomap.json.
// ---------------------------------------------------------------------------
function build() {
  const project = makeProject();
  const cwd = process.cwd().replace(/\\/g, "/");
  const rel = (p) => p.replace(cwd + "/", "");
  const files = {}, dependents = {}, features = {};

  for (const sf of project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (path.includes("node_modules") || path.includes(".next")) continue;
    const exports = [...sf.getExportedDeclarations()].map(([name, d]) => ({
      name: name === "default" ? (d[0]?.getName?.() ?? "default") : name,
      kind: d[0]?.getKindName?.() ?? "?",
    }));
    // Dependency edges from static imports + re-export barrels, with the set
    // of named symbols crossing each edge (used for edge weights + the ident
    // graph). importedSymbols[targetPath] = [names...].
    const importedSymbols = {};
    const addEdge = (tp, names) => {
      if (tp.includes("node_modules")) return;
      (importedSymbols[tp] ??= []).push(...names);
    };
    for (const imp of sf.getImportDeclarations()) {
      const t = imp.getModuleSpecifierSourceFile();
      if (!t) continue;
      const names = imp.getNamedImports().map((n) => n.getName());
      if (imp.getDefaultImport()) names.push("default"); // canonical: local alias never matches the export name
      if (imp.getNamespaceImport()) names.push("*");
      addEdge(rel(t.getFilePath()), names.length ? names : ["*"]);
    }
    for (const exp of sf.getExportDeclarations()) {
      const t = exp.getModuleSpecifierSourceFile();
      if (!t) continue;
      addEdge(rel(t.getFilePath()), exp.getNamedExports().map((n) => n.getName()));
    }
    const imports = Object.keys(importedSymbols);
    for (const tp of imports) (dependents[tp] ??= []).push(path);
    files[path] = { exports, imports, importedSymbols };
    const feat = featureOf(path);
    if (feat) (features[feat] ??= []).push(path);
  }
  for (const p in files) files[p].dependents = dependents[p] ?? [];

  // --- File PageRank: edges importer→imported, weighted by # symbols crossed.
  const nodes = Object.keys(files);
  const fileEdges = [];
  for (const [p, f] of Object.entries(files))
    for (const tp of f.imports)
      if (files[tp]) fileEdges.push({ from: p, to: tp, weight: (f.importedSymbols[tp] || []).length || 1 });
  const fileRank = pagerank(nodes, fileEdges);
  for (const p of nodes) files[p].pagerank = +(fileRank[p] || 0).toFixed(6);

  // --- Symbol ranking (Aider-style): identifier graph from named imports.
  const rankedSymbols = rankSymbols(files, null);

  // hubs: now PageRank-ranked (raw dependent count shown alongside).
  const hubs = nodes
    .map((p) => [p, files[p].pagerank, files[p].dependents.length])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([p, pr, deg]) => `${p} (deg ${deg}, pr ${pr})`);

  const out = {
    schema: SCHEMA_VERSION, generatedSha: currentSha(), dirty: dirtyCount(), fileCount: nodes.length,
    hubs, features, rankedSymbols: rankedSymbols.slice(0, 80), files,
  };
  mkdirSync(".claude", { recursive: true });
  writeFileSync(MAP, JSON.stringify(out));
  return out;
}

// Build the Aider-style identifier graph from the file map and return a
// ranked list of { file, name, kind, rank }. `focus` (Set of paths) +
// derived mentioned idents personalize the ranking when given.
function rankSymbols(files, focus) {
  const defines = new Map();      // ident -> Set(file)
  const references = new Map();   // ident -> [file...] (multiplicity)
  const definition = new Map();   // `${file}|${ident}` -> {file, name, kind}
  for (const [p, f] of Object.entries(files)) {
    for (const e of f.exports) {
      (defines.get(e.name) ?? defines.set(e.name, new Set()).get(e.name)).add(p);
      definition.set(`${p}|${e.name}`, { file: p, name: e.name, kind: e.kind });
    }
  }
  for (const [p, f] of Object.entries(files))
    for (const tp of f.imports)
      for (const name of f.importedSymbols[tp] || [])
        if (name !== "*" && name !== "default") (references.get(name) ?? references.set(name, []).get(name)).push(p);

  // mentioned idents from focus files' exports + their basenames
  let mentioned = null;
  if (focus && focus.size) {
    mentioned = new Set();
    for (const p of focus) {
      for (const e of (files[p]?.exports || [])) mentioned.add(e.name);
      const base = p.split("/").pop().replace(/\.[^.]+$/, "");
      mentioned.add(base);
    }
  }

  const nodes = Object.keys(files);
  const edges = [];
  for (const ident of defines.keys()) {
    if (!references.has(ident)) continue;
    const mul = identMul(ident, defines.get(ident).size, mentioned);
    const counts = new Map();
    for (const refFile of references.get(ident)) counts.set(refFile, (counts.get(refFile) || 0) + 1);
    for (const [refFile, n] of counts)
      for (const defFile of defines.get(ident)) {
        if (refFile === defFile) continue;
        let useMul = mul;
        if (focus && focus.has(refFile)) useMul *= 50;
        edges.push({ from: refFile, to: defFile, weight: useMul * Math.sqrt(n), ident });
      }
  }
  // personalization seeds: focus files + files whose name matches a mention
  let pers = null;
  if (focus && focus.size) {
    pers = {};
    const unit = 100 / nodes.length;
    for (const p of nodes) {
      let v = 0;
      if (focus.has(p)) v += unit;
      const parts = new Set([...p.split("/"), p.split("/").pop(), p.split("/").pop().replace(/\.[^.]+$/, "")]);
      if (mentioned && [...parts].some((x) => mentioned.has(x))) v += unit;
      if (v > 0) pers[p] = v;
    }
    if (!Object.keys(pers).length) pers = null;
  }
  const rank = pagerank(nodes, edges, pers ? { personalization: pers } : {});

  // redistribute each file's rank across its out-edges onto (defFile, ident)
  const out = new Map();      // `${file}|${ident}` -> total weight
  const totalW = new Map();
  for (const e of edges) totalW.set(e.from, (totalW.get(e.from) || 0) + e.weight);
  for (const e of edges) {
    const share = (rank[e.from] || 0) * e.weight / (totalW.get(e.from) || 1);
    const k = `${e.to}|${e.ident}`;
    out.set(k, (out.get(k) || 0) + share);
  }
  return [...out.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([k, r]) => ({ ...(definition.get(k) || { file: k.slice(0, k.lastIndexOf("|")), name: k.slice(k.lastIndexOf("|") + 1), kind: "?" }), rank: +r.toFixed(6) }))
    .filter((d) => !(focus && focus.has(d.file)));
}

// Serve the cached map only when provably current: same HEAD, known schema,
// clean tree. A dirty tree REBUILDS from disk so queries reflect in-flight edits.
function ensureFresh() {
  const sha = currentSha();
  if (existsSync(MAP)) {
    try {
      const cached = JSON.parse(readFileSync(MAP, "utf8"));
      // Trust cache only if: same HEAD, known schema, it was built CLEAN
      // (cached.dirty === 0 — never trust a map built mid-edit, even after a
      // revert returns the tree to clean), AND the tree is clean right now.
      if (sha && cached.generatedSha === sha && cached.schema === SCHEMA_VERSION && cached.dirty === 0 && dirtyCount() === 0) return cached;
    } catch {}
  }
  return build();
}

// Resolve a query to a file key: exact path → unique basename → unique substring.
function resolveFile(keys, filesObj, q) {
  if (filesObj[q]) return { key: q };
  const base = keys.filter((k) => k.split("/").pop() === q);
  if (base.length === 1) return { key: base[0] };
  const subs = keys.filter((k) => k.toLowerCase().includes(q.toLowerCase()));
  if (subs.length === 1) return { key: subs[0] };
  return { key: null, candidates: subs };
}

function fileBlock(key, f) {
  console.log(`exports (${f.exports.length}): ${f.exports.map((e) => `${e.name}(${e.kind})`).join(", ") || "—"}`);
  console.log(`imports (${f.imports.length}): ${f.imports.join(", ") || "—"}`);
  console.log(`dependents (${f.dependents.length}): ${f.dependents.join(", ") || "—"}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const arg = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

if (has("--any")) {
  // Unified router: cached structure (file → symbol → feature) then a LIVE
  // git-grep fallback for data/copy/string-literals the graph never indexes.
  const raw = arg("--any") || "";
  if (!raw) { console.log('--any needs a query, e.g. `--any PremiumCard` or `--any "multi-modal"`'); }
  else {
    const q = raw.toLowerCase();
    const data = ensureFresh();
    const keys = Object.keys(data.files);
    const { key: fileKey, candidates } = resolveFile(keys, data.files, raw);
    const symHits = [];
    for (const [path, f] of Object.entries(data.files))
      for (const e of f.exports)
        if (e.name.toLowerCase().includes(q)) symHits.push(`  ${path} → ${e.name} (${e.kind})`);
    const featNames = Object.keys(data.features || {}).filter((k) => k.toLowerCase().includes(q));
    if (fileKey) {
      console.log(`[structure:file] ${fileKey}  (pr ${data.files[fileKey].pagerank ?? "—"})`);
      fileBlock(fileKey, data.files[fileKey]);
    } else if (symHits.length || featNames.length) {
      console.log(`[structure] ${symHits.length} symbol, ${featNames.length} feature match for "${raw}"`);
      if (symHits.length) console.log(symHits.join("\n"));
      if (featNames.length) console.log("features: " + featNames.map((n) => `${n} (${data.features[n].length})`).join(", "));
    } else if (candidates && candidates.length > 1) {
      console.log(`[structure] "${raw}" matched ${candidates.length} files — narrow it:`);
      for (const k of candidates) console.log(`  ${k}`);
    } else {
      const res = contentSearch(raw);
      if (!res) console.log(`[content] 0 match for "${raw}" (git grep, tracked + untracked)`);
      else {
        const lines = res.split("\n");
        console.log(`[content] ${lines.length} line${lines.length > 1 ? "s" : ""}${lines.length > 40 ? " (showing 40)" : ""}:`);
        console.log(lines.slice(0, 40).join("\n"));
      }
    }
  }
} else if (has("--find")) {
  const raw = arg("--find") || "", q = raw.toLowerCase();
  const data = ensureFresh();
  const hits = [];
  for (const [path, f] of Object.entries(data.files))
    for (const e of f.exports)
      if (e.name.toLowerCase().includes(q)) hits.push(`  ${path} → ${e.name} (${e.kind})`);
  console.log(`find "${raw}": ${hits.length} match`);
  if (hits.length) console.log(hits.join("\n"));
} else if (has("--relates")) {
  const q = arg("--relates") || "";
  const data = ensureFresh();
  const keys = Object.keys(data.files);
  const { key, candidates } = resolveFile(keys, data.files, q);
  if (!key) {
    if (candidates && candidates.length > 1) { console.log(`relates: "${q}" matched ${candidates.length} files — narrow it:`); for (const k of candidates) console.log(`  ${k}`); }
    else console.log(`relates: no file matching "${q}"`);
  } else {
    const f = data.files[key];
    console.log(`relates: ${key}  (pr ${f.pagerank ?? "—"})`);
    fileBlock(key, f);
    // query-focused relevance: personalized PageRank (random-walk-with-restart)
    // on a BIDIRECTIONAL graph → files most related to the target, transitively.
    const biEdges = [];
    for (const [p, ff] of Object.entries(data.files))
      for (const tp of ff.imports) if (data.files[tp]) { biEdges.push({ from: p, to: tp, weight: 1 }); biEdges.push({ from: tp, to: p, weight: 1 }); }
    const rel = pagerank(keys, biEdges, { personalization: { [key]: 1 } });
    const top = Object.entries(rel).filter(([k]) => k !== key).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`related (random-walk relevance):`);
    for (const [k, r] of top) console.log(`  ${k} (${r.toFixed(4)})`);
  }
} else if (has("--map")) {
  // Token-budgeted ranked digest (Aider's killer feature). --focus <path>
  // personalizes toward a file; default budget 1024, ×8 with no focus.
  const data = ensureFresh();
  const focusArg = arg("--focus");
  const tk = parseInt(arg("--tokens") ?? "", 10);
  const budget = Number.isFinite(tk) && tk > 0 ? tk : (focusArg ? 1024 : 8192);
  let ranked = data.rankedSymbols || [];
  let focusLabel = "global";
  if (focusArg) {
    const { key, candidates } = resolveFile(Object.keys(data.files), data.files, focusArg);
    if (key) { ranked = rankSymbols(data.files, new Set([key])); focusLabel = key; }
    else console.error(`# warning: --focus "${focusArg}" matched ${(candidates && candidates.length) || 0} files — using global ranking`);
  }
  // Fallback for default-export-heavy repos (sparse named-symbol graph): build
  // the digest from file PageRank so --map is never empty.
  if (!ranked.length)
    ranked = Object.entries(data.files)
      .sort((a, b) => (b[1].pagerank || 0) - (a[1].pagerank || 0))
      .flatMap(([file, f]) => (f.exports || []).map((e) => ({ file, name: e.name, kind: e.kind, rank: f.pagerank || 0 })));
  console.log(`# repomap (${data.fileCount} files, sha ${data.generatedSha}) — focus: ${focusLabel}, budget ~${budget} tok`);
  let used = 0, shown = 0;
  const byFile = new Map();
  for (const s of ranked) { if (!byFile.has(s.file)) byFile.set(s.file, []); byFile.get(s.file).push(s); }
  for (const [file, syms] of byFile) {
    const line = `\n${file}:\n` + syms.slice(0, 8).map((s) => `  ${s.name} (${s.kind})`).join("\n");
    const t = tokEst(line);
    if (used + t > budget) break;
    used += t; shown++; console.log(line);
  }
  console.log(`\n# ~${used} tokens (${shown} files shown)`);
} else if (has("--symbols")) {
  const data = ensureFresh();
  const sn = parseInt(arg("--symbols") ?? "", 10); const n = Number.isFinite(sn) && sn > 0 ? sn : 30;
  console.log(`top ${n} ranked symbols (Aider-style):`);
  for (const s of (data.rankedSymbols || []).slice(0, n)) console.log(`  ${s.rank}  ${s.file} → ${s.name} (${s.kind})`);
} else if (has("--feature")) {
  const raw = arg("--feature") || "", q = raw.toLowerCase();
  const data = ensureFresh();
  const name = Object.keys(data.features).find((k) => k.toLowerCase() === q) || Object.keys(data.features).find((k) => k.toLowerCase().includes(q));
  if (!name) console.log(`feature: no match for "${raw}" — run --features to list them.`);
  else {
    const fl = data.features[name], set = new Set(fl), exts = new Set();
    for (const p of fl) for (const dep of (data.files[p]?.dependents || [])) if (!set.has(dep)) exts.add(dep);
    console.log(`feature "${name}": ${fl.length} files`);
    for (const p of fl) console.log(`  ${p}`);
    console.log(`external dependents (${exts.size}): ${[...exts].join(", ") || "—"}`);
  }
} else if (has("--features")) {
  const data = ensureFresh();
  const list = Object.entries(data.features).map(([k, v]) => [k, v.length]).sort((a, b) => b[1] - a[1]);
  console.log(`features (${list.length}):`);
  for (const [k, n] of list) console.log(`  ${k} (${n} files)`);
} else if (has("--hubs")) {
  const data = ensureFresh();
  console.log(`repomap: ${data.fileCount} files (sha ${data.generatedSha})`);
  console.log("hubs (PageRank importance):");
  for (const h of data.hubs) console.log(`  ${h}`);
} else if (has("--print")) {
  const data = ensureFresh();
  console.log(JSON.stringify({ hubs: data.hubs, features: data.features, rankedSymbols: data.rankedSymbols, files: data.files }));
} else {
  const out = build();
  console.log(`repomap: ${out.fileCount} files | ${Object.keys(out.features).length} features | top hub: ${out.hubs[0] || "—"}`);
}
