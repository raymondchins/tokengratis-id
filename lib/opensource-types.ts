// Schema untuk domain "Proyek Open Source Indonesia".
// Domain TERPISAH dari Provider LLM — JANGAN dicampur ke lib/types.ts.
//
// Anti-halusinasi (CORE PRINCIPLE): tiap field di sini BENERAN ada di sumber
// (GitHub API REST /repos/{owner}/{repo}). Field nullable = emang bisa kosong di
// sumber (mis. description / language / license / homepage). Field absent JANGAN
// di-render jadi sel "Unknown".

/** Provenance — mirror SourceRef di lib/types.ts. */
export interface OpenSourceSource {
  name: string; // "IndopenSource/awesome-indonesia" (kurasi) / "GitHub API" (metadata)
  url: string;
  syncedAt: string; // ISO — kapan sumber ini di-fetch
}

export interface OpenSourceProject {
  /** "owner/repo" lowercased, dipakai sebagai React key (bukan route — proyek nge-link keluar ke GitHub). */
  slug: string;
  fullName: string; // "OpenSID/OpenSID"
  name: string; // "OpenSID"
  owner: string; // "OpenSID"
  ownerUrl: string; // https://github.com/OpenSID
  ownerAvatar: string | null; // owner.avatar_url
  url: string; // repo html_url
  homepage: string | null; // homepage (null kalau "")
  description: string | null; // null kalau sumber kosong
  language: string | null; // bahasa utama (null kalau sumber kosong)
  stars: number; // stargazers_count
  forks: number; // forks_count
  openIssues: number; // open_issues_count
  license: string | null; // SPDX id; null kalau "NOASSERTION"/"NONE"/kosong
  topics: string[]; // topics[] (lengkap, ga di-truncate)
  archived: boolean; // archived flag
  pushedAt: string; // pushed_at ISO — update kode terakhir
  createdAt: string | null; // created_at ISO
}

/** Wrapper output `data/opensource.json` — provenance dipakai bareng semua proyek. */
export interface OpenSourceData {
  projects: OpenSourceProject[];
  sources: OpenSourceSource[]; // [kurasi awesome-indonesia, metadata GitHub API]
  syncedAt: string; // ISO — kapan pipeline kita jalan
  count: number;
}
