// Audit duplicate: slug, model-within-provider, near-dupe, provider-level.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { modelKey, canonicalSlug } from "./lib/normalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "providers.json"), "utf8"),
);

let issues = 0;
const flag = (msg) => {
  issues++;
  console.log("  ✗ " + msg);
};

// 1) SLUG UNIQUENESS
console.log("\n[1] Slug uniqueness");
const slugSeen = new Map();
for (const p of data) slugSeen.set(p.slug, (slugSeen.get(p.slug) || 0) + 1);
const dupSlugs = [...slugSeen].filter(([, n]) => n > 1);
if (dupSlugs.length) dupSlugs.forEach(([s, n]) => flag(`slug "${s}" x${n}`));
else console.log("  ✓ semua " + data.length + " slug unik");

// 2) MODEL DUP WITHIN PROVIDER — by modelKey (kalau ada, merge bug)
console.log("\n[2] Model dup dalam 1 provider (by modelKey — harusnya 0)");
let mkDup = 0;
for (const p of data) {
  const seen = new Map();
  for (const m of p.models) {
    const k = modelKey(m.name || m.id);
    if (!k) continue;
    if (seen.has(k)) {
      flag(`${p.slug}: modelKey "${k}" → "${seen.get(k)}" & "${m.name}"`);
      mkDup++;
    } else seen.set(k, m.name);
  }
}
if (!mkDup) console.log("  ✓ ga ada model dgn modelKey sama dalam 1 provider");

// 3) MODEL DUP WITHIN PROVIDER — by exact name/id (case-insensitive)
console.log("\n[3] Model dup dalam 1 provider (nama/id persis sama)");
let exactDup = 0;
for (const p of data) {
  const seenN = new Map();
  const seenI = new Map();
  for (const m of p.models) {
    const n = (m.name || "").toLowerCase().trim();
    const id = (m.id || "").toLowerCase().trim();
    if (n && seenN.has(n)) { flag(`${p.slug}: nama "${m.name}" muncul 2x`); exactDup++; }
    else if (n) seenN.set(n, 1);
    if (id && seenI.has(id)) { flag(`${p.slug}: id "${m.id}" muncul 2x`); exactDup++; }
    else if (id) seenI.set(id, 1);
  }
}
if (!exactDup) console.log("  ✓ ga ada nama/id model identik dalam 1 provider");

// 4) NEAR-DUPE MODELS — alnum-only key match (lebih longgar dari modelKey)
//    Nangkep dupe yg modelKey kelewat (mis. beda suffix yg ga di-strip).
console.log("\n[4] Near-dupe model dalam 1 provider (alnum-only, longgar)");
const alnum = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
let near = 0;
for (const p of data) {
  const keys = p.models.map((m) => ({ a: alnum(m.name || m.id), name: m.name }));
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const A = keys[i].a, B = keys[j].a;
      if (!A || !B) continue;
      // satu jadi prefix/substring kuat dari yg lain (>=8 char) → suspect
      if (A === B || (A.length >= 8 && B.length >= 8 && (A.includes(B) || B.includes(A)))) {
        console.log(`  ? ${p.slug}: "${keys[i].name}" ~ "${keys[j].name}"`);
        near++;
      }
    }
  }
}
if (!near) console.log("  ✓ ga ada near-dupe mencurigakan");
else console.log(`  (${near} pasang suspect — review manual, "?" = warning bukan error)`);

// 5) PROVIDER-LEVEL near-dupe (slug beda tapi nama mirip → alias kelewat)
console.log("\n[5] Provider near-dupe (slug beda, nama mirip → alias gap?)");
let pNear = 0;
for (let i = 0; i < data.length; i++) {
  for (let j = i + 1; j < data.length; j++) {
    const a = alnum(data[i].name), b = alnum(data[j].name);
    if (!a || !b) continue;
    if (a === b || (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a)))) {
      console.log(`  ? "${data[i].name}" (${data[i].slug}) ~ "${data[j].name}" (${data[j].slug})`);
      pNear++;
    }
  }
}
if (!pNear) console.log("  ✓ ga ada provider yg namanya mirip");

// 6) SANITY: tiap canonicalSlug(name) === slug tersimpan (konsistensi dedup-key)
console.log("\n[6] Konsistensi canonicalSlug(name) vs slug tersimpan");
let mismatch = 0;
for (const p of data) {
  const cs = canonicalSlug(p.name);
  if (cs !== p.slug) { console.log(`  ? "${p.name}": canonicalSlug→"${cs}" tapi slug="${p.slug}"`); mismatch++; }
}
if (!mismatch) console.log("  ✓ semua slug konsisten dgn canonicalSlug(name)");

console.log(`\n=== ${issues} HARD issue (slug/exact dup), warning "?" review manual ===`);
process.exit(issues ? 1 : 0);
