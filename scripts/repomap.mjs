import { Project } from "ts-morph";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

const MAP = ".claude/repomap.json";
const sh = (c) => { try { return execSync(c).toString().trim(); } catch { return ""; } };
const currentSha = () => sh("git rev-parse --short HEAD");
// Count uncommitted source files — any extension the graph indexes (.ts/.tsx
// plus the .mjs/.cjs/.js pipeline files added below) so a dirty tree triggers
// a rebuild rather than serving a stale cache.
const dirtyCount = () =>
  sh("git status --porcelain").split("\n").filter((l) => /\.(ts|tsx|mjs|cjs|jsx|js)$/.test(l)).length;

// Feature = first real route segment under app/ (or src/app/), skipping route
// groups (parens), dynamic segments ([id]) and parallel routes (@slot).
function featureOf(path) {
  const m = path.match(/(?:^|.*\/)(?:src\/)?app\/(.+)/);
  if (!m) return null;
  const parts = m[1].split("/");
  for (const p of parts.slice(0, -1)) {
    if (p.startsWith("(") || p.startsWith("[") || p.startsWith("@")) continue;
    return p;
  }
  return null;
}

function build() {
  const project = new Project({ tsConfigFilePath: "tsconfig.json" });
  // tsconfig `include` globs usually cover only .ts/.tsx, so build/pipeline
  // scripts (.mjs/.cjs/.js) are invisible to ts-morph. Add them by path
  // explicitly — ts-morph parses them regardless of the tsconfig include set —
  // so their dependency graph (often the most interconnected code) is mapped.
  project.addSourceFilesAtPaths(["scripts/**/*.mjs", "scripts/**/*.cjs", "scripts/**/*.js", "*.mjs", "*.cjs"]);
  const cwd = process.cwd().replace(/\\/g, "/");
  const rel = (p) => p.replace(cwd + "/", "");
  const files = {}, dependents = {}, features = {};

  for (const sf of project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (path.includes("node_modules") || path.includes(".next")) continue;
    const exports = [...sf.getExportedDeclarations()].map(
      ([name, d]) => ({
        // getExportedDeclarations() keys a default export as the literal
        // "default" — fall back to the declaration's own name so --find can
        // locate default-exported pages/components by their real symbol.
        name: name === "default" ? (d[0]?.getName?.() ?? "default") : name,
        kind: d[0]?.getKindName() ?? "?",
      })
    );
    // Dependency edges from BOTH static imports and re-export barrels
    // (`export ... from "./x"`), deduped per file so a module imported twice
    // (e.g. value + `import type`) counts as one edge.
    const importSet = new Set();
    for (const imp of sf.getImportDeclarations()) {
      const t = imp.getModuleSpecifierSourceFile();
      if (!t) continue;
      const tp = rel(t.getFilePath());
      if (tp.includes("node_modules")) continue;
      importSet.add(tp);
    }
    for (const exp of sf.getExportDeclarations()) {
      const t = exp.getModuleSpecifierSourceFile();
      if (!t) continue;
      const tp = rel(t.getFilePath());
      if (tp.includes("node_modules")) continue;
      importSet.add(tp);
    }
    const imports = [...importSet];
    for (const tp of imports) (dependents[tp] ??= []).push(path);
    files[path] = { exports, imports };
    const feat = featureOf(path);
    if (feat) (features[feat] ??= []).push(path);
  }
  for (const p in files) files[p].dependents = dependents[p] ?? [];
  const hubs = Object.entries(files)
    .map(([p, f]) => [p, f.dependents.length])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([p, n]) => `${p} (${n})`);
  const out = { generatedSha: currentSha(), fileCount: Object.keys(files).length, hubs, features, files };
  mkdirSync(".claude", { recursive: true });
  writeFileSync(MAP, JSON.stringify(out));
  return out;
}

// Serve the cached map ONLY when it is provably current: same committed HEAD,
// known schema (features key present), AND a clean working tree. A dirty tree
// REBUILDS — build() reads saved files from disk, so queries reflect in-flight
// edits. Querying mid-edit (before commit) is the tool's highest-value moment,
// so it must never answer from a pre-edit snapshot.
function ensureFresh() {
  const sha = currentSha();
  if (existsSync(MAP)) {
    try {
      const cached = JSON.parse(readFileSync(MAP, "utf8"));
      if (sha && cached.generatedSha === sha && cached.features && dirtyCount() === 0) {
        return cached;
      }
    } catch {}
  }
  return build();
}

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const arg = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

if (has("--find")) {
  const raw = arg("--find") || "";
  const q = raw.toLowerCase();
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
  // Resolve target by exact path → unique basename → unique substring. If a
  // substring is ambiguous, LIST the candidates instead of silently picking the
  // first insertion-order match (a wrong-but-confident blast-radius answer).
  const subs = keys.filter((k) => k.includes(q));
  const base = keys.filter((k) => k.split("/").pop() === q);
  const key = data.files[q] ? q : (base.length === 1 ? base[0] : (subs.length === 1 ? subs[0] : null));
  if (!key) {
    if (subs.length > 1) {
      console.log(`relates: "${q}" matched ${subs.length} files — narrow it:`);
      for (const k of subs) console.log(`  ${k}`);
    } else {
      console.log(`relates: no file matching "${q}"`);
    }
  } else {
    const f = data.files[key];
    console.log(`relates: ${key}`);
    console.log(`exports (${f.exports.length}): ${f.exports.map((e) => `${e.name}(${e.kind})`).join(", ") || "—"}`);
    console.log(`imports (${f.imports.length}): ${f.imports.join(", ") || "—"}`);
    console.log(`dependents (${f.dependents.length}): ${f.dependents.join(", ") || "—"}`);
  }
} else if (has("--feature")) {
  const raw = arg("--feature") || "";
  const q = raw.toLowerCase();
  const data = ensureFresh();
  const name = Object.keys(data.features).find((k) => k.toLowerCase() === q)
    || Object.keys(data.features).find((k) => k.toLowerCase().includes(q));
  if (!name) console.log(`feature: no match for "${raw}" — run --features to list them.`);
  else {
    const fl = data.features[name];
    const set = new Set(fl);
    const exts = new Set();
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
  console.log("hubs (most depended-on):");
  for (const h of data.hubs) console.log(`  ${h}`);
} else if (has("--print")) {
  const data = ensureFresh();
  console.log(JSON.stringify({ hubs: data.hubs, features: data.features, files: data.files }));
} else {
  const out = build();
  console.log(`repomap: ${out.fileCount} files | ${Object.keys(out.features).length} features | hubs: ${out.hubs.slice(0, 3).join(", ")}`);
}
