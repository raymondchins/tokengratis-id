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
  /** URL sumber utama — bikin "lihat daftar lengkap di sumber" clickable. */
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
          <div className="relative w-full sm:w-auto">
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
              className="w-full min-h-[44px] rounded-[4px] border border-ink-line bg-ink py-1.5 pl-8 pr-3 text-xs text-fog placeholder:text-mute focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 sm:w-44"
            />
          </div>
        )}
      </div>

      {/* mobile cards (hidden on md+) */}
      <div className="divide-y divide-ink-line md:hidden">
        {slice.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-mute">
            <p>Ga ada model yang cocok sama &ldquo;{q}&rdquo;.</p>
            <button
              type="button"
              onClick={() => {
                setQ("");
                setPage(1);
              }}
              className="mt-3 min-h-[44px] rounded-full border border-ink-line bg-ink px-4 text-xs font-medium text-fog transition-colors hover:border-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 active:bg-ink-line/60"
            >
              Hapus pencarian
            </button>
          </div>
        ) : (
          slice.map((m) => (
            <div key={m.id} className="px-4 py-3.5">
              <div className="mb-2 min-w-0">
                <div className="font-medium text-fog">{m.name}</div>
                <div className="break-all font-mono text-[11px] text-mute">{m.id}</div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {m.modality && (
                  <div>
                    <dt className="font-semibold uppercase tracking-wider text-mute">Modality</dt>
                    <dd className="text-fog">{m.modality}</dd>
                  </div>
                )}
                {m.context && (
                  <div>
                    <dt className="font-semibold uppercase tracking-wider text-mute">Context</dt>
                    <dd className="font-medium text-fog">{m.context}</dd>
                  </div>
                )}
                {m.maxOutput && (
                  <div>
                    <dt className="font-semibold uppercase tracking-wider text-mute">Output</dt>
                    <dd className="text-fog">{m.maxOutput}</dd>
                  </div>
                )}
                {m.rateLimit && (
                  <div className="col-span-2">
                    <dt className="font-semibold uppercase tracking-wider text-mute">Rate limit</dt>
                    <dd className="text-fog">{m.rateLimit}</dd>
                  </div>
                )}
              </dl>
            </div>
          ))
        )}
      </div>

      {/* desktop table (hidden below md) */}
      <div className="hidden overflow-x-auto md:block">
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
                  <p>Ga ada model yang cocok sama &ldquo;{q}&rdquo;.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      setPage(1);
                    }}
                    className="mt-3 min-h-[44px] rounded-full border border-ink-line bg-ink px-4 text-xs font-medium text-fog transition-colors hover:border-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 active:bg-ink-line/60"
                  >
                    Hapus pencarian
                  </button>
                </td>
              </tr>
            ) : (
              slice.map((m) => (
                <tr key={m.id} className="align-top transition-colors hover:bg-ink/50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-fog">{m.name}</div>
                    <div className="break-all font-mono text-[11px] text-mute">{m.id}</div>
                  </td>
                  {/* null = sel kosong, BUKAN em dash — dash klaim "dicek, kosong", cell kosong = "ga disediain sumber". */}
                  <td className="px-3 py-3 text-mute">{m.modality}</td>
                  <td className="px-3 py-3 font-medium text-fog">{m.context}</td>
                  <td className="px-3 py-3 text-mute">{m.maxOutput}</td>
                  <td className="px-5 py-3 text-mute">{m.rateLimit}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* note: model lain dari sumber (bukan entri detail) */}
      {more && (
        <p className="border-t border-ink-line px-5 py-3 text-xs text-mute">
          + {more} model lainnya —{" "}
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-ink-line underline-offset-2 hover:text-fog"
            >
              lihat daftar lengkap di sumber
            </a>
          ) : (
            "lihat daftar lengkap di sumber"
          )}
          .
        </p>
      )}

      {/* pagination */}
      {pages > 1 && (
        <nav
          aria-label="Navigasi halaman model"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-line px-5 py-3 text-xs text-mute"
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
              className="min-h-[44px] min-w-[44px] rounded-[4px] border border-ink-line bg-ink px-3 py-1.5 font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 active:bg-ink-line/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setPage(current + 1)}
              disabled={current >= pages}
              aria-label="Halaman model berikutnya"
              className="min-h-[44px] min-w-[44px] rounded-[4px] border border-ink-line bg-ink px-3 py-1.5 font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 active:bg-ink-line/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Berikutnya →
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
