"use client";

import { useEffect, useMemo, useState } from "react";
import type { OpenSourceProject } from "@/lib/opensource-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

type SortKey = "stars" | "pushed" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  stars: "Stars terbanyak",
  pushed: "Baru di-update",
  name: "Nama A-Z",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border px-4 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70",
        active
          ? "border-mute/60 bg-ink-line/70 text-fog"
          : "border-ink-line bg-ink-soft text-mute hover:border-mute hover:text-fog",
      ].join(" ")}
    >
      {children}
    </button>
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

  // Filter + sort
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = projects.filter((p) => {
      if (lang && p.language !== lang) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.owner.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        p.topics.some((t) => t.toLowerCase().includes(q))
      );
    });

    list = list.slice().sort((a, b) => {
      if (sort === "stars") return b.stars - a.stars;
      if (sort === "pushed") return b.pushedAt.localeCompare(a.pushedAt);
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [projects, search, lang, sort]);

  // Reset to page 1 on filter/sort change
  useEffect(() => setPage(1), [search, lang, sort]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const rangeFrom = (current - 1) * PAGE_SIZE + 1;
  const rangeTo = (current - 1) * PAGE_SIZE + pageItems.length;

  const isFiltered = search !== "" || lang !== "";

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[8px] border border-ink-line bg-ink-soft px-8 py-20 text-center">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-grass-solid" />
        <p className="mt-4 text-base font-medium text-fog">Direktori lagi dibangun</p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-mute">
          Pipeline sync nyusul — proyek dari sumber komunitas lagi diproses.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Controls ── */}
      <div className="flex flex-col gap-4">
        {/* Search */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari proyek, owner, atau topik — OpenSID, laravel, CLI…"
            aria-label="Cari proyek open source"
            className="w-full rounded-[8px] border border-ink-line bg-ink-soft py-3.5 pl-11 pr-4 text-sm text-fog placeholder:text-mute focus:border-fog/40 focus:outline-none focus:ring-2 focus:ring-fog/70 transition-colors"
          />
        </div>

        {/* Language chips + sort */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          {/* Desktop: chip pills */}
          {languages.length > 0 && (
            <div className="-mx-1 hidden flex-wrap items-center gap-2 px-1 sm:flex">
              <Chip active={lang === ""} onClick={() => setLang("")}>
                Semua bahasa
              </Chip>
              {languages.map((l) => (
                <Chip key={l} active={lang === l} onClick={() => setLang(lang === l ? "" : l)}>
                  {l}
                </Chip>
              ))}
            </div>
          )}

          {/* Mobile: language select + sort sebaris */}
          <div className="flex items-center justify-between gap-3 sm:hidden">
            {languages.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-mute">
                Bahasa
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  aria-label="Filter bahasa"
                  className="rounded-[4px] border border-ink-line bg-ink-soft px-3 py-1.5 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40"
                >
                  <option value="">Semua</option>
                  {languages.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {/* Sort on mobile */}
            <label className="flex items-center gap-2 text-sm text-mute">
              Urut
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-[4px] border border-ink-line bg-ink-soft px-3 py-1.5 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Desktop: sort */}
          <div className="hidden shrink-0 justify-end sm:flex">
            <label className="flex items-center gap-2 text-sm text-mute">
              Urutkan
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-[4px] border border-ink-line bg-ink-soft px-3 py-1.5 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-[8px] border border-ink-line bg-ink-soft">
        {results.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-base font-medium text-fog">Ga ada yang cocok sama filter ini.</p>
            <p className="mt-2 text-sm text-mute">Coba hapus beberapa filter atau ganti kata kunci.</p>
            <button
              type="button"
              onClick={() => { setSearch(""); setLang(""); }}
              className="mt-6 rounded-full border border-ink-line bg-ink px-5 py-2 text-sm font-medium text-fog transition-colors hover:border-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40"
            >
              Reset semua filter
            </button>
          </div>
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
        <p className="text-sm text-mute">
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

        {totalPages > 1 && (
          <nav aria-label="Navigasi halaman proyek" className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage(current - 1)}
              disabled={current <= 1}
              aria-label="Halaman sebelumnya"
              className="min-h-[40px] rounded-[6px] border border-ink-line bg-ink-soft px-3 py-2 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            {pageNumbers(current, totalPages).map((n, i) =>
              n === "…" ? (
                <span
                  key={`gap-${i}`}
                  aria-hidden="true"
                  className="min-h-[40px] px-1.5 py-2 text-sm text-mute"
                >
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-label={`Halaman ${n}`}
                  aria-current={n === current ? "page" : undefined}
                  className={`min-h-[40px] min-w-[40px] rounded-[6px] border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 ${
                    n === current
                      ? "border-ember bg-ember text-white"
                      : "border-ink-line bg-ink-soft text-mute hover:border-mute hover:text-fog"
                  }`}
                >
                  {n}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setPage(current + 1)}
              disabled={current >= totalPages}
              aria-label="Halaman berikutnya"
              className="min-h-[40px] rounded-[6px] border border-ink-line bg-ink-soft px-3 py-2 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
