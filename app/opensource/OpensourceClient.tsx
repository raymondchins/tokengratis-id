"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OpenSourceProject } from "@/lib/opensource-types";
import FilterBar from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import EmptyDataPanel from "@/components/EmptyDataPanel";
import NoResultsPanel from "@/components/NoResultsPanel";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

type SortKey = "stars" | "pushed" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  stars: "Stars terbanyak",
  pushed: "Baru di-update",
  name: "Nama A-Z",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

// Dipisah dari `results` biar bisa dipakai ulang buat hitung chip count
// (lihat languageCounts) tanpa duplikasi logic match.
function matchesSearch(p: OpenSourceProject, q: string): boolean {
  if (!q) return true;
  return (
    p.name.toLowerCase().includes(q) ||
    p.owner.toLowerCase().includes(q) ||
    (p.description?.toLowerCase().includes(q) ?? false) ||
    p.topics.some((t) => t.toLowerCase().includes(q))
  );
}

// ─── Grid layout ──────────────────────────────────────────────────────────────
// Project (avatar+name+desc) | Lang | Stars+Forks | Topics | CTA
const GRID_COLS =
  "min-w-[860px] grid-cols-[minmax(200px,2fr)_minmax(100px,0.8fr)_minmax(100px,0.8fr)_minmax(180px,1.4fr)_88px] items-center gap-4 px-5 text-left";

// ─── Row ──────────────────────────────────────────────────────────────────────

function ProjectRow({ p, priority = false }: { p: OpenSourceProject; priority?: boolean }) {
  const ariaLabel = `${p.fullName}${p.description ? " — " + p.description : ""}`;
  const rowLinkProps = {
    href: p.url,
    target: "_blank" as const,
    rel: "noopener noreferrer",
    "aria-label": ariaLabel,
  };

  // Topic chips — max 3, then "+N"
  const MAX_TOPICS = 3;
  const shownTopics = p.topics.length > MAX_TOPICS ? p.topics.slice(0, MAX_TOPICS - 1) : p.topics;
  const extraTopics = p.topics.slice(shownTopics.length);

  const TopicsCell = () =>
    p.topics.length === 0 ? null : (
      <div className="flex flex-wrap gap-1">
        {shownTopics.map((t) => (
          <span
            key={t}
            className="inline-flex items-center rounded-[4px] border border-grape-line bg-grape-bg px-2 py-0.5 text-[11px] font-medium text-grape"
          >
            {t}
          </span>
        ))}
        {extraTopics.length > 0 && (
          <span className="inline-flex items-center rounded-[4px] border border-ink-line bg-ink px-2 py-0.5 text-[11px] font-medium text-mute">
            +{extraTopics.length}
          </span>
        )}
      </div>
    );

  return (
    <>
      {/* ── Mobile card ── */}
      <a
        {...rowLinkProps}
        className="group flex flex-col gap-3 border-t border-ink-line px-4 py-4 transition-colors hover:bg-ink/40 focus-visible:bg-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog focus-visible:ring-inset md:hidden"
      >
        <div className="flex items-center gap-3 min-w-0">
          {p.ownerAvatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.ownerAvatar}
              alt={p.owner}
              width={36}
              height={36}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority ? "high" : undefined}
              className="h-9 w-9 shrink-0 rounded-full border border-ink-line object-cover"
            />
          )}
          <div className="min-w-0">
            <span className="block truncate font-semibold text-fog">{p.name}</span>
            <span className="text-[11px] text-mute">{p.owner}</span>
          </div>
          {p.archived && (
            <span className="ml-auto shrink-0 rounded-[4px] border border-ink-line px-2 py-0.5 text-[10px] font-medium text-mute">
              arsip
            </span>
          )}
        </div>

        {p.description && (
          <p className="line-clamp-2 text-[13px] leading-snug text-mute">{p.description}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[13px] text-mute">
            <span>★ {formatStars(p.stars)}</span>
            {p.forks > 0 && <span>{p.forks} forks</span>}
            {p.language && (
              <span className="inline-flex items-center rounded-[4px] border border-ink-line bg-ink px-2 py-0.5 text-[11px] font-medium text-mute">
                {p.language}
              </span>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center rounded-[6px] bg-ember px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-ember-soft">
            Lihat
          </span>
        </div>

        {p.topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <TopicsCell />
          </div>
        )}
      </a>

      {/* ── Desktop grid row ── */}
      <a
        {...rowLinkProps}
        className={`group hidden border-t border-ink-line py-4 transition-colors hover:bg-ink/40 focus-visible:bg-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog focus-visible:ring-inset md:grid ${GRID_COLS}`}
      >
        {/* Project */}
        <div className="flex items-center gap-3 min-w-0">
          {p.ownerAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.ownerAvatar}
              alt={p.owner}
              width={32}
              height={32}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority ? "high" : undefined}
              className="h-8 w-8 shrink-0 rounded-full border border-ink-line object-cover"
            />
          ) : (
            <div className="h-8 w-8 shrink-0 rounded-full border border-ink-line bg-ink" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="block truncate font-semibold text-fog">{p.name}</span>
              {p.archived && (
                <span className="shrink-0 rounded-[4px] border border-ink-line px-1.5 py-0.5 text-[10px] font-medium text-mute">
                  arsip
                </span>
              )}
            </div>
            <span className="text-[11px] text-mute">{p.owner}</span>
            {p.description && (
              <p className="mt-0.5 line-clamp-1 text-[12px] leading-snug text-mute">
                {p.description}
              </p>
            )}
          </div>
        </div>

        {/* Language */}
        <div>
          {p.language ? (
            <span className="inline-flex items-center rounded-[4px] border border-ink-line bg-ink px-2 py-0.5 text-[11px] font-medium text-mute">
              {p.language}
            </span>
          ) : null}
        </div>

        {/* Stars + Forks */}
        <div className="flex flex-col gap-0.5 text-[13px]">
          <span className="font-semibold text-fog">★ {formatStars(p.stars)}</span>
          {p.forks > 0 && (
            <span className="text-[11px] text-mute">{formatStars(p.forks)} forks</span>
          )}
        </div>

        {/* Topics */}
        <div>
          <TopicsCell />
        </div>

        {/* CTA */}
        <div className="flex justify-end">
          <span className="inline-flex items-center rounded-[6px] bg-ember px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-ember-soft">
            Lihat
          </span>
        </div>
      </a>
    </>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export default function OpensourceClient({
  projects,
  languages,
}: {
  projects: OpenSourceProject[];
  languages: string[];
}) {
  const [search, setSearch] = useState("");
  const [lang, setLang] = useState<string>(""); // "" = all
  const [sort, setSort] = useState<SortKey>("stars");
  const [page, setPage] = useState(1);

  // ── URL state (shareable + refresh-safe) ──────────────────────────────────
  // Statis (SSG) — sengaja BUKAN useSearchParams/useRouter (itu maksa dynamic
  // rendering). Baca window.location manual sekali pas mount, tulis balik via
  // replaceState. skipNextPageResetRef nyegah efek "reset ke halaman 1 pas
  // filter/sort berubah" (di bawah) nge-overwrite halaman yang baru di-restore
  // dari URL, TAPI cuma kalau hydration ini emang ngubah filter/sort juga
  // (kalau cuma page doang yang di-restore, efek reset itu ga bakal
  // ke-trigger sama sekali, jadi ga butuh di-skip).
  const skipNextPageResetRef = useRef(false);
  const isFirstUrlSyncRef = useRef(true);

  // Filter + sort
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = projects.filter((p) => (!lang || p.language === lang) && matchesSearch(p, q));

    list = list.slice().sort((a, b) => {
      if (sort === "stars") return b.stars - a.stars;
      if (sort === "pushed") return b.pushedAt.localeCompare(a.pushedAt);
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [projects, search, lang, sort]);

  // Chip count = hasil kalau chip ITU diklik. Bahasa di sini single-select
  // (radio — klik chip lain GANTI `lang`, bukan nambah kayak modality di /),
  // jadi angkanya dihitung dari search doang (TANPA `lang` yang lagi aktif).
  // Kalau dihitung dari `results` (yang udah kena filter `lang` sekarang),
  // angka buat chip lain bakal keliru — makanya bukan sekadar reuse `results`.
  const languageCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const counts: Record<string, number> = {};
    for (const l of languages) counts[l] = 0;
    for (const p of projects) {
      if (p.language && counts[p.language] !== undefined && matchesSearch(p, q)) {
        counts[p.language]++;
      }
    }
    return counts;
  }, [projects, languages, search]);

  // Reset to page 1 on filter/sort change
  useEffect(() => {
    if (skipNextPageResetRef.current) {
      skipNextPageResetRef.current = false;
      return;
    }
    setPage(1);
  }, [search, lang, sort]);

  // Hydrate dari query string sekali pas mount. Tiap value divalidasi ke
  // known-valid values — link basi (bahasa/sort yang udah ga ada) di-drop
  // diam-diam, ga pernah nge-crash.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let filtersChanged = false;

    const qParam = params.get("q");
    if (qParam) {
      setSearch(qParam);
      filtersChanged = true;
    }

    const langParam = params.get("lang");
    if (langParam && languages.includes(langParam)) {
      setLang(langParam);
      filtersChanged = true;
    }

    const sortParam = params.get("sort");
    if (sortParam && (Object.keys(SORT_LABELS) as string[]).includes(sortParam)) {
      setSort(sortParam as SortKey);
      filtersChanged = true;
    }

    const pageParam = params.get("page");
    if (pageParam) {
      const n = Number(pageParam);
      if (Number.isInteger(n) && n > 0) {
        setPage(n);
        if (filtersChanged) skipNextPageResetRef.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronin state balik ke URL — replaceState (BUKAN pushState, ga nambah
  // history entry per klik filter). Ref-guard biar invocation pertama (yang
  // masih state default, sebelum efek hydrate di atas kelar) ga nge-clobber
  // URL yang baru masuk.
  useEffect(() => {
    if (isFirstUrlSyncRef.current) {
      isFirstUrlSyncRef.current = false;
      return;
    }
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (lang) qs.set("lang", lang);
    if (sort !== "stars") qs.set("sort", sort);
    if (page > 1) qs.set("page", String(page));
    const query = qs.toString();
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [search, lang, sort, page]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const rangeFrom = (current - 1) * PAGE_SIZE + 1;
  const rangeTo = (current - 1) * PAGE_SIZE + pageItems.length;

  const isFiltered = search !== "" || lang !== "";

  function resetFilters() {
    setSearch("");
    setLang("");
  }

  const activeCount = (lang ? 1 : 0) + (search.trim() ? 1 : 0);

  // Label filter aktif buat NoResultsPanel — nyebut penyebabnya biar user
  // bisa lepas satu, bukan cuma nuke-semua. Pola sama kayak DirectoryClient.
  const activeLabels = useMemo<string[]>(() => {
    const labels: string[] = [];
    if (lang) labels.push(lang);
    const q = search.trim();
    if (q) labels.push(`"${q}"`);
    return labels;
  }, [lang, search]);

  if (projects.length === 0) {
    return (
      <EmptyDataPanel
        title="Direktori lagi dibangun"
        description="Pipeline sync nyusul — proyek dari sumber komunitas lagi diproses."
        action={{ href: "/#direktori", label: "Kembali ke direktori" }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Controls ── */}
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Cari proyek, owner, atau topik — OpenSID, laravel, CLI…",
          label: "Cari proyek open source",
        }}
        chipGroups={
          languages.length > 0
            ? [
                {
                  id: "language",
                  label: "Bahasa",
                  // showLabel: false (default) — cuma 1 grup di sini, judul
                  // "Bahasa" ga nambah info yang belum jelas dari chip-nya sendiri.
                  options: languages.map((l) => ({
                    id: l,
                    label: l,
                    count: languageCounts[l],
                  })),
                  selected: lang ? [lang] : [],
                  // Single-select: klik chip lain GANTI `lang`, bukan nambah ke array.
                  onToggle: (id) => setLang((prev) => (prev === id ? "" : id)),
                },
              ]
            : []
        }
        sort={{
          value: sort,
          options: SORT_LABELS,
          onChange: (v) => setSort(v as SortKey),
        }}
        activeCount={activeCount}
        onReset={resetFilters}
      />

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-[8px] border border-ink-line bg-ink-soft">
        {results.length === 0 ? (
          <NoResultsPanel
            message="Ga ada yang cocok sama filter ini."
            hint="Coba hapus beberapa filter atau ganti kata kunci."
            onReset={resetFilters}
            activeLabels={activeLabels}
          />
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop header */}
            <div
              aria-hidden="true"
              className={`hidden md:grid ${GRID_COLS} py-3 text-[11px] font-semibold uppercase tracking-wider text-mute`}
            >
              <span>Proyek</span>
              <span>Bahasa</span>
              <span>Stars</span>
              <span>Topik</span>
              <span className="text-right">Aksi</span>
            </div>
            {pageItems.map((p, i) => (
              <ProjectRow key={p.slug} p={p} priority={current === 1 && i < 3} />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer row: count + pagination ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mute" aria-live="polite">
          {results.length === 0 ? (
            <>
              Menampilkan <span className="font-semibold text-fog">0</span> dari{" "}
              <span className="font-semibold text-fog">{projects.length}</span> proyek
            </>
          ) : totalPages === 1 ? (
            <>
              Menampilkan{" "}
              <span className="font-semibold text-fog">
                {isFiltered ? results.length : projects.length}
              </span>
              {isFiltered && (
                <>
                  {" "}dari{" "}
                  <span className="font-semibold text-fog">{projects.length}</span>
                </>
              )}{" "}
              proyek
            </>
          ) : (
            <>
              Menampilkan{" "}
              <span className="font-semibold text-fog">
                {rangeFrom}–{rangeTo}
              </span>{" "}
              dari <span className="font-semibold text-fog">{results.length}</span>{" "}
              proyek
            </>
          )}
        </p>

        <Pagination
          current={current}
          total={totalPages}
          onChange={setPage}
          ariaLabel="Navigasi halaman proyek"
        />
      </div>
    </div>
  );
}
