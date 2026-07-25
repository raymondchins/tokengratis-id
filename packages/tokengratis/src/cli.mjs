#!/usr/bin/env node
// tokengratis — CLI for the tokengratis.id free-tier LLM API directory.
// Zero dependencies, plain Node ESM.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getProviders, DataFetchError } from "./lib/data.mjs";
import { filterByModality, filterByMinContext, searchProviders, listModels } from "./lib/filters.mjs";
import { createColorizer } from "./lib/color.mjs";
import {
  formatProviderListText,
  formatProviderText,
  formatModelListText,
  formatSearchResultsText,
} from "./lib/render.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));

const HELP = `tokengratis v${pkg.version} — CLI direktori free-tier LLM API (tokengratis.id)

Usage:
  tokengratis list [--modality <m>] [--min-context <ctx>] [--json]
  tokengratis show <slug> [--json]
  tokengratis search <query> [--json]
  tokengratis models [--provider <slug>] [--json]
  tokengratis --help
  tokengratis --version

Flag global:
  --json        output machine-readable
  --refresh     abaikan cache, ambil ulang dari server (alias: --no-cache)

Contoh:
  tokengratis list
  tokengratis list --modality vision
  tokengratis list --min-context 128K --json
  tokengratis show openrouter
  tokengratis search llama
  tokengratis models --provider groq

Data live dari https://tokengratis.id/api/providers
(fallback otomatis ke GitHub raw kalau API down). Cached lokal ~1 jam —
umur data selalu ditulis di bawah output; pakai --refresh buat maksa segar.

Ini AGGREGATOR, bukan verifier — tiap provider bawa provenance
(sources[] + syncedAt), transparan apa adanya dari sumber.`;

/**
 * Baris umur data. Sengaja SELALU ditampilkan di output teks.
 *
 * Kenapa: data di-cache 1 jam di temp dir. Pas data upstream diperbaiki
 * (INCIDENT 2026-07-25), siapa pun yang sempat jalanin CLI sebelum perbaikan
 * bakal terus ngeliat angka lama sampai satu jam — dan sebelumnya ga ada satu
 * pun petunjuk bahwa yang dia liat itu cache. Diam-diam nyajiin data basi itu
 * pelanggaran prinsip proyek ini (selalu tunjukin KAPAN datanya). Sekarang
 * umurnya kelihatan, dan --refresh kasih jalan keluar.
 */
function ageNote(fetchedAt, color) {
  const mins = Math.max(0, Math.round((Date.now() - fetchedAt) / 60000));
  const when = mins < 1 ? "barusan" : mins === 1 ? "1 menit lalu" : `${mins} menit lalu`;
  const hint = mins >= 1 ? " · paksa segarkan: --refresh" : "";
  return color.dim(`Data diambil ${when}${hint}`);
}

function getFlagValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx === args.length - 1) return undefined;
  return args[idx + 1];
}

/** Remove known flags (with or without a value) from an args array, leaving positionals. */
function positionals(args, valueFlags) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (valueFlags.includes(a)) {
      i++; // skip its value
      continue;
    }
    if (a === "--json") continue;
    if (a.startsWith("--")) continue; // unknown flag, ignore rather than crash
    out.push(a);
  }
  return out;
}

async function cmdList(args, { json, color, refresh }) {
  const modality = getFlagValue(args, "--modality");
  const minContext = getFlagValue(args, "--min-context");
  const { providers, fetchedAt } = await getProviders({ forceRefresh: refresh });

  let list = providers;
  list = filterByModality(list, modality);
  list = filterByMinContext(list, minContext);

  if (json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }
  if (list.length === 0) {
    console.log(formatProviderListText(list, { color }));
    return;
  }
  console.log(formatProviderListText(list, { color }));
  console.log("");
  console.log(color.dim(`${list.length} provider. Detail: tokengratis show <slug>`));
  console.log(ageNote(fetchedAt, color));
}

async function cmdShow(args, { json, color, refresh }) {
  const [slug] = positionals(args, ["--modality", "--min-context", "--provider"]);
  if (!slug) {
    console.error("Error: slug wajib diisi. Contoh: tokengratis show openrouter");
    process.exitCode = 1;
    return;
  }
  const { providers, fetchedAt } = await getProviders({ forceRefresh: refresh });
  const p = providers.find((x) => x.slug === slug);
  if (!p) {
    console.error(`Error: provider dengan slug "${slug}" tidak ditemukan. Coba: tokengratis list`);
    process.exitCode = 1;
    return;
  }
  if (json) {
    console.log(JSON.stringify(p, null, 2));
    return;
  }
  console.log(formatProviderText(p, { color }));
  console.log("");
  console.log(ageNote(fetchedAt, color));
}

async function cmdSearch(args, { json, color, refresh }) {
  const query = positionals(args, ["--modality", "--min-context", "--provider"]).join(" ").trim();
  if (!query) {
    console.error('Error: query wajib diisi. Contoh: tokengratis search "llama"');
    process.exitCode = 1;
    return;
  }
  const { providers, fetchedAt } = await getProviders({ forceRefresh: refresh });
  const results = searchProviders(providers, query);
  if (json) {
    console.log(
      JSON.stringify(
        results.map((r) => ({
          slug: r.provider.slug,
          name: r.provider.name,
          providerMatch: r.providerMatch,
          matchedModels: r.matchedModels,
        })),
        null,
        2
      )
    );
    return;
  }
  console.log(formatSearchResultsText(results, query, { color }));
  console.log("");
  console.log(ageNote(fetchedAt, color));
}

async function cmdModels(args, { json, color, refresh }) {
  const providerSlug = getFlagValue(args, "--provider");
  const { providers, fetchedAt } = await getProviders({ forceRefresh: refresh });
  const rows = listModels(providers, providerSlug);
  if (json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  console.log(formatModelListText(rows, { color }));
  console.log("");
  console.log(color.dim(`${rows.length} model.`));
  console.log(ageNote(fetchedAt, color));
}

async function main(argv) {
  const args = argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    console.log(pkg.version);
    return;
  }
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return;
  }

  const [command, ...rest] = args;
  const json = args.includes("--json");
  const refresh = args.includes("--refresh") || args.includes("--no-cache");
  const color = createColorizer();

  switch (command) {
    case "list":
      await cmdList(rest, { json, color, refresh });
      break;
    case "show":
      await cmdShow(rest, { json, color, refresh });
      break;
    case "search":
      await cmdSearch(rest, { json, color, refresh });
      break;
    case "models":
      await cmdModels(rest, { json, color, refresh });
      break;
    default:
      console.error(`Perintah tidak dikenal: "${command}"\n`);
      console.error(HELP);
      process.exitCode = 1;
  }
}

main(process.argv).catch((err) => {
  if (err instanceof DataFetchError) {
    console.error(`Error: ${err.message}`);
  } else {
    console.error(`Error: ${err && err.message ? err.message : err}`);
  }
  process.exitCode = 1;
});
