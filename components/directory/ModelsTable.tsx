"use client";

import { useMemo, useState } from "react";
import type { Model } from "@/lib/types";
import { MODELS_PAGE_SIZE } from "@/lib/constants";
import SearchIcon from "@/components/SearchIcon";

const PAGE_SIZE = MODELS_PAGE_SIZE;

export default function ModelsTable({
  models,
  more,
  sourceUrl,
}: {
  models: Model[];
  more?: string | null;
  /** URL sumber utama — bikin "di sumber" clickable. */
  sourceUrl?: string | null;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return models;
    return models.filter((m) =>
      `${m.name} ${m.id}`.toLowerCase().includes(query),
    );
  }, [models, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const searchable = models.length > PAGE_SIZE;

  return (
    <section className="overflow-hidden rounded-[8px] border border-ink-line bg-ink-soft">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-line px-5 py-3.5">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mute">
          Model tersedia ({models.length}
          {more ? "+" : ""})
        </p>
        {searchable && (
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mute" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Cari model…"
              aria-label="Cari model"
              className="w-44 rounded-[4px] border border-ink-line bg-ink py-1.5 pl-8 pr-3 text-xs text-fog placeholder:text-mute focus:border-fog/40 focus:outline-none focus:ring-2 focus:ring-fog/30"
            />
          </div>
        )}
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-mute">
              <th className="px-5 py-2.5 font-semibold">Model</th>
              <th className="px-3 py-2.5 font-semibold">Modality</th>
              <th className="px-3 py-2.5 font-semibold">Context</th>
              <th className="px-3 py-2.5 font-semibold">Output</th>
              <th className="px-5 py-2.5 font-semibold">Rate limit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line border-t border-ink-line">
            {slice.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-mute">
                  Ga ada model yang cocok sama &ldquo;{q}&rdquo;.
                </td>
              </tr>
            ) : (
              slice.map((m) => (
                <tr key={m.id} className="align-top transition-colors hover:bg-ink/50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-fog">{m.name}</div>
                    <div className="font-mono text-[11px] text-mute">{m.id}</div>
                  </td>
                  <td className="px-3 py-3 text-mute">{m.modality}</td>
                  <td className="px-3 py-3 font-medium text-fog">{m.context ?? "—"}</td>
                  <td className="px-3 py-3 text-mute">{m.maxOutput ?? "—"}</td>
                  <td className="px-5 py-3 text-mute">{m.rateLimit ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* note: model lain dari sumber (bukan entri detail) */}
      {more && (
        <p className="border-t border-ink-line px-5 py-3 text-xs text-mute">
          + {more} — daftar lengkapnya ada{" "}
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-ink-line underline-offset-2 hover:text-fog"
            >
              di sumber
            </a>
          ) : (
            "di sumber"
          )}
          .
        </p>
      )}

      {/* pagination */}
      {pages > 1 && (
        <nav
          aria-label="Navigasi halaman model"
          className="flex items-center justify-between gap-3 border-t border-ink-line px-5 py-3 text-xs text-mute"
        >
          <span>
            Hal {current}/{pages} · {filtered.length} model
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPage(current - 1)}
              disabled={current <= 1}
              aria-label="Halaman model sebelumnya"
              className="rounded-[4px] border border-ink-line bg-ink px-3 py-1.5 font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setPage(current + 1)}
              disabled={current >= pages}
              aria-label="Halaman model berikutnya"
              className="rounded-[4px] border border-ink-line bg-ink px-3 py-1.5 font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
