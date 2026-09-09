import type { Modality } from "./types";
import type { SortKey } from "./filter";

/** Plain-language labels translate source facets, never infer model capabilities. */
export const NEED_LABELS: Record<Modality, string> = {
  text: "Chat & teks",
  code: "Coding",
  vision: "Baca gambar",
  image: "Gambar",
  audio: "Audio",
  video: "Video",
  embeddings: "Embeddings",
  reranking: "Reranking",
};

export const NEED_ORDER: Modality[] = ["text", "code", "vision", "image", "audio", "video", "embeddings", "reranking"];

export type DirectoryState = {
  search: string;
  modalities: Modality[];
  onlyFree: boolean;
  sort: SortKey;
  page: number;
};

export function initialDirectoryState(): DirectoryState {
  return { search: "", modalities: [], onlyFree: false, sort: "popular", page: 1 };
}

/** Keep existing shared q/m/g/sort/page URLs working, including multi-facet AND. */
export function readDirectoryState(search: string): DirectoryState {
  const sp = new URLSearchParams(search);
  const sort = sp.get("sort");
  const page = Number(sp.get("page"));
  return {
    search: sp.get("q") ?? "",
    modalities: [...new Set((sp.get("m") ?? "").split(","))]
      .filter((m): m is Modality => NEED_ORDER.includes(m as Modality)),
    onlyFree: sp.get("g") === "1",
    sort: sort === "context" || sort === "models" || sort === "name" ? sort : "popular",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function writeDirectoryState(state: DirectoryState): string {
  const sp = new URLSearchParams();
  if (state.search.trim()) sp.set("q", state.search.trim());
  if (state.modalities.length) sp.set("m", state.modalities.join(","));
  if (state.onlyFree) sp.set("g", "1");
  if (state.sort !== "popular") sp.set("sort", state.sort);
  if (state.page > 1) sp.set("page", String(state.page));
  return sp.toString();
}
