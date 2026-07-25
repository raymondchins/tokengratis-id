// Shared data-fetching module for both the CLI and the MCP server.
//
// Fetches the live tokengratis.id provider directory at runtime (no bundled
// copy shipped with this package). tokengratis.id is itself an AGGREGATOR,
// not a verifier — this module just moves that data around, it never
// invents or infers fields that aren't in the upstream JSON.
//
// Resolution order:
//   1. Primary:  https://tokengratis.id/api/providers        (bare Provider[])
//   2. Fallback: raw.githubusercontent.com .../data/providers.json
//
// Caching:
//   - In-memory for the lifetime of the current process.
//   - A short-TTL file cache in the OS temp dir so back-to-back CLI
//     invocations (separate processes) don't re-fetch every time.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PRIMARY_URL = "https://tokengratis.id/api/providers";
export const FALLBACK_URL =
  "https://raw.githubusercontent.com/raymondchins/tokengratis-id/main/data/providers.json";

const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_FILE = path.join(os.tmpdir(), "tokengratis-cli-cache.json");

/** Thrown for any user-facing data problem (network, bad response, etc). */
export class DataFetchError extends Error {
  constructor(message) {
    super(message);
    this.name = "DataFetchError";
  }
}

/** @type {{ providers: unknown[], fetchedAt: number, source: string } | null} */
let memoryCache = null;

async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    if (err && err.name === "TimeoutError") {
      throw new Error(`timeout setelah ${FETCH_TIMEOUT_MS}ms`);
    }
    throw new Error(err?.message || String(err));
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  try {
    return await res.json();
  } catch {
    throw new Error("respons bukan JSON valid");
  }
}

function readFileCache() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.fetchedAt !== "number" ||
      !Array.isArray(parsed.providers)
    ) {
      return null;
    }
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeFileCache(entry) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(entry), "utf8");
  } catch {
    // Best-effort — a stale/unwritable temp dir must never break the CLI/MCP server.
  }
}

/**
 * Get the current provider directory.
 *
 * @param {{ forceRefresh?: boolean }} [opts]
 * @returns {Promise<{ providers: import("./types.mjs").Provider[], fetchedAt: number, source: string }>}
 */
export async function getProviders(opts = {}) {
  const { forceRefresh = false } = opts;

  if (memoryCache && !forceRefresh) return memoryCache;

  if (!forceRefresh) {
    const cached = readFileCache();
    if (cached) {
      memoryCache = cached;
      return cached;
    }
  }

  let providers;
  let source = PRIMARY_URL;
  let primaryErr;
  try {
    providers = await fetchJson(PRIMARY_URL);
  } catch (err) {
    primaryErr = err;
    source = FALLBACK_URL;
    try {
      providers = await fetchJson(FALLBACK_URL);
    } catch (fallbackErr) {
      throw new DataFetchError(
        "Gagal mengambil data provider tokengratis.id.\n" +
          `  Primary  (${PRIMARY_URL}): ${primaryErr.message}\n` +
          `  Fallback (${FALLBACK_URL}): ${fallbackErr.message}\n` +
          "Cek koneksi internet kamu, atau coba lagi sebentar lagi."
      );
    }
  }

  if (!Array.isArray(providers)) {
    throw new DataFetchError(
      `Respons data provider dari ${source} tidak valid (bukan array JSON).`
    );
  }

  const entry = { providers, fetchedAt: Date.now(), source };
  memoryCache = entry;
  writeFileCache(entry);
  return entry;
}
