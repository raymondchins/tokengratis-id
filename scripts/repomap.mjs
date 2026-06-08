import { Project } from "ts-morph";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

const MAP = ".claude/repomap.json";
const sh = (c) => { try { return execSync(c).toString().trim(); } catch { return ""; } };
const currentSha = () => sh("git rev-parse --short HEAD");
const dirtyCount = () =>
  sh("git status --porcelain").split("\n").filter((l) => /\.(ts|tsx)$/.test(l)).length;

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
  const cwd = process.cwd().replace(/\\/g, "/");
  const rel = (p) => p.replace(cwd + "/", "");
  const files = {}, dependents = {}, features = {};

  for (const sf of project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (path.includes("node_modules") || path.includes(".next")) continue;
    const exports = [...sf.getExportedDeclarations()].map(
      ([name, d]) => ({ name, kind: d[0]?.getKindName() ?? "?" })
    );
    const imports = [];
    for (const imp of sf.getImportDeclarations()) {
      const t = imp.getModuleSpecifierSourceFile();
      if (!t) continue;
      const tp = rel(t.getFilePath());
      if (tp.includes("node_modules")) continue;
      imports.push(tp);
      (dependents[tp] ??= []).push(path);
    }
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

// Serve cached map; rebuild only if missing, HEAD changed, or schema is old
// (no `features` key = pre-feature map). Warn (stderr) if working tree dirty.
function ensureFresh() {
  const sha = currentSha();
  if (existsSync(MAP)) {
    try {
      const cached = JSON.parse(readFileSync(MAP, "utf8"));
      if (sha && cached.generatedSha === sha && cached.features) {
        const d = dirtyCount();
        if (d) console.error(`⚠ repomap: ${d} uncommitted .ts/.tsx file(s) — run \`npm run repomap\` for exact current state`);
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
  const key = data.files[q] ? q : Object.keys(data.files).find((k) => k.includes(q));
  if (!key) console.log(`relates: no file matching "${q}"`);
  else {
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
