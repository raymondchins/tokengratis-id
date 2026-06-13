import type { OpenSourceData, OpenSourceProject, OpenSourceSource } from "./opensource-types";
import rawData from "@/data/opensource.json";

const data = rawData as unknown as OpenSourceData;

/** Semua proyek open source. */
export function getProjects(): OpenSourceProject[] {
  return data.projects;
}

/** Sumber provenance (kurasi + GitHub API). */
export function getOpenSourceSources(): OpenSourceSource[] {
  return data.sources;
}

/** ISO timestamp kapan pipeline terakhir jalan. */
export function getOpenSourceSyncedAt(): string {
  return data.syncedAt;
}

/**
 * Bahasa unik dari semua proyek, diurutkan:
 * 1. Frekuensi desc (bahasa terbanyak duluan).
 * 2. Alphabetical untuk frekuensi yang sama.
 * Null language di-skip.
 */
export function getLanguages(): string[] {
  const freq = new Map<string, number>();
  for (const p of data.projects) {
    if (p.language) {
      freq.set(p.language, (freq.get(p.language) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort(([aLang, aCount], [bLang, bCount]) =>
      bCount !== aCount ? bCount - aCount : aLang.localeCompare(bLang),
    )
    .map(([lang]) => lang);
}
