"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { filterProviders, sortProviders, SORT_LABELS, type SortKey } from "@/lib/filter";
import type { Modality, ProviderListItem } from "@/lib/types";
import { DIRECTORY_PAGE_SIZE } from "@/lib/constants";
import { initialDirectoryState, readDirectoryState, writeDirectoryState, NEED_LABELS, NEED_ORDER, type DirectoryState } from "@/lib/directory-state";
import ProviderCard from "@/components/directory/ProviderCard";
import SearchIcon from "@/components/SearchIcon";
import Pagination from "@/components/Pagination";
import EmptyDataPanel from "@/components/EmptyDataPanel";
import NoResultsPanel from "@/components/NoResultsPanel";

const QUICK_NEEDS: Modality[] = ["text", "code", "vision", "image", "audio"];
const CHIP = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors";

export default function DirectoryClient({ items }: { items: ProviderListItem[] }) {
  const [state, setState] = useState<DirectoryState>(initialDirectoryState);
  const [ready, setReady] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  // Initial HTML stays static. Read on mount and on Back/Forward; never overwrite
  // a shared URL before it has been read, or discard Next's history metadata.
  useEffect(() => {
    function restore() {
      const next = readDirectoryState(window.location.search);
      setState(next);
      setAdvanced(next.onlyFree || next.modalities.length > 1 || next.modalities.some((m) => !QUICK_NEEDS.includes(m)));
      setReady(true);
    }
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const results = useMemo(() => {
    const matches = filterProviders(items, state);
    return sortProviders(state.onlyFree ? matches.filter((p) => Boolean(p.freeLimit)) : matches, state.sort);
  }, [items, state]);
  const totalPages = Math.max(1, Math.ceil(results.length / DIRECTORY_PAGE_SIZE));
  const currentPage = Math.min(state.page, totalPages);
  const pageItems = results.slice((currentPage - 1) * DIRECTORY_PAGE_SIZE, currentPage * DIRECTORY_PAGE_SIZE);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = writeDirectoryState({ ...state, page: currentPage });
      const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(window.history.state, "", url);
    }, 200);
    return () => clearTimeout(timer);
  }, [state, ready, currentPage]);

  const available = useMemo(() => NEED_ORDER.filter((m) => items.some((p) => p.modalities.includes(m))), [items]);
  const active = Boolean(state.search.trim() || state.modalities.length || state.onlyFree);
  function change(patch: Partial<DirectoryState>) {
    setState((previous) => ({ ...previous, ...patch, page: 1 }));
  }
  function reset() {
    setState(initialDirectoryState());
    searchInput.current?.focus();
  }
  function chooseNeed(modality?: Modality) {
    // Main controls replace the need, rather than invisibly stacking AND filters.
    change({ modalities: modality ? [modality] : [], onlyFree: false });
  }
  function goToResults() {
    resultHeading.current?.focus({ preventScroll: true });
    resultHeading.current?.scrollIntoView({ block: "start" });
  }

  if (!items.length) return <EmptyDataPanel title="Daftar token belum tersedia" description="Data dari sumber komunitas belum tersedia. Coba kembali nanti." />;

  return (
    <div>
      <form role="search" onSubmit={(event) => { event.preventDefault(); goToResults(); }} className="flex items-center gap-2 rounded-2xl border border-mute bg-ink-soft p-2 pl-4 focus-within:ring-2 focus-within:ring-fog">
        <SearchIcon className="h-5 w-5 shrink-0 text-mute" />
        <label htmlFor="token-search" className="sr-only">Cari nama penyedia atau model AI</label>
        <input ref={searchInput} id="token-search" type="search" autoComplete="off" value={state.search} onChange={(event) => change({ search: event.target.value })} placeholder="Cari Gemini, Groq, DeepSeek…" className="min-h-12 min-w-0 flex-1 border-0 bg-transparent px-1 text-base text-fog outline-none placeholder:text-mute" />
        <button type="submit" className="min-h-12 shrink-0 rounded-xl bg-ember px-5 text-sm font-semibold text-white transition-colors hover:bg-ember-soft">Cari</button>
      </form>

      <div className="mt-5">
        <p id="need-label" className="mb-3 text-sm text-mute">Atau pilih kebutuhanmu</p>
        <div role="group" aria-labelledby="need-label" className="flex flex-wrap gap-2">
          <button type="button" onClick={() => chooseNeed()} aria-pressed={!state.modalities.length} className={`${CHIP} ${!state.modalities.length ? "border-fog bg-fog text-white" : "border-ink-line bg-ink-soft text-fog hover:border-mute"}`}>Semua</button>
          {QUICK_NEEDS.filter((m) => available.includes(m)).map((m) => {
            const selected = state.modalities.length === 1 && state.modalities[0] === m;
            return <button key={m} type="button" aria-pressed={selected} onClick={() => chooseNeed(selected ? undefined : m)} className={`${CHIP} ${selected ? "border-fog bg-fog text-white" : "border-ink-line bg-ink-soft text-fog hover:border-mute"}`}>{NEED_LABELS[m]}</button>;
          })}
          <button type="button" aria-expanded={advanced} aria-controls="extra-filters" onClick={() => setAdvanced((open) => !open)} className={`${CHIP} border-transparent text-mute hover:text-fog`}>Filter lainnya <span aria-hidden="true">{advanced ? "−" : "+"}</span></button>
        </div>
      </div>

      {advanced && <div id="extra-filters" className="mt-4 rounded-xl border border-ink-line bg-ink-soft p-4 sm:p-5">
        <fieldset>
          <legend className="text-sm font-semibold text-fog">Gabungkan kemampuan</legend>
          <p className="mt-1 text-xs leading-relaxed text-mute">Penyedia harus punya semua kemampuan yang dipilih. Dukungan tiap model bisa berbeda.</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {available.map((m) => <label key={m} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={state.modalities.includes(m)} onChange={() => change({ modalities: state.modalities.includes(m) ? state.modalities.filter((v) => v !== m) : [...state.modalities, m] })} className="h-4 w-4 accent-fog" />{NEED_LABELS[m]}</label>)}
          </div>
        </fieldset>
        <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 border-t border-ink-line pt-3 text-sm"><input type="checkbox" checked={state.onlyFree} onChange={(event) => change({ onlyFree: event.target.checked })} className="h-4 w-4 accent-fog" />Hanya yang mencantumkan ringkasan kuota</label>
        <p className="mt-1 text-xs leading-relaxed text-mute">Kuota tidak tercantum bukan berarti berbayar. Batas lengkap ada di halaman penyedia.</p>
      </div>}

      {active && <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-mute" aria-label="Filter aktif">
        <span>Hasil untuk:</span>
        {state.search.trim() && <span className="font-medium text-fog">“{state.search.trim()}”</span>}
        {state.modalities.map((m) => <button key={m} type="button" onClick={() => change({ modalities: state.modalities.filter((value) => value !== m) })} aria-label={`Hapus filter ${NEED_LABELS[m]}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink-line bg-ink-soft px-3">{NEED_LABELS[m]} <span aria-hidden="true">×</span></button>)}
        {state.onlyFree && <span>Ringkasan kuota tersedia</span>}
        <button type="button" onClick={reset} className="min-h-11 px-2 font-semibold text-fog underline underline-offset-4">Hapus filter</button>
      </div>}

      <div className="mt-9 flex flex-wrap items-end justify-between gap-4 border-t border-ink-line pt-6">
        <div>
          <h2 ref={resultHeading} tabIndex={-1} className="scroll-mt-32 font-sans text-xl font-semibold tracking-tight outline-none sm:text-2xl" aria-live="polite" aria-atomic="true">{results.length} penyedia API gratis{active ? " ditemukan" : " untuk dicoba"}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-mute">Pilih penyedia, lihat batas gratisnya, lalu ikuti cara pakainya.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-mute">Urutkan
          <select value={state.sort} onChange={(event) => change({ sort: event.target.value as SortKey })} className="min-h-11 max-w-full rounded-lg border border-ink-line bg-ink-soft px-3 pr-7 text-sm text-fog">
            {Object.entries(SORT_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {(state.modalities.includes("image") || state.modalities.includes("audio") || state.modalities.includes("video")) && <p className="mt-4 text-sm leading-relaxed text-mute">Label gambar, audio, dan video mengikuti sumber; tidak selalu berarti bisa membuat media. Cek kemampuan input/output model di penyedia.</p>}

      {results.length ? <div className="mt-6 grid gap-x-6 gap-y-6 md:grid-cols-2">
        {pageItems.map((provider, index) => <ProviderCard key={provider.slug} provider={provider} priority={currentPage === 1 && index < 2} />)}
      </div> : <NoResultsPanel message="Belum ada yang cocok." hint="Coba nama model lain atau kurangi filter kebutuhanmu." onReset={reset} activeLabels={[...(state.search.trim() ? [state.search.trim()] : []), ...state.modalities.map((m) => NEED_LABELS[m])]} />}

      {results.length > 0 && <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-ink-line pt-5">
        <p className="text-xs text-mute" aria-live="polite">Menampilkan {(currentPage - 1) * DIRECTORY_PAGE_SIZE + 1}–{Math.min(currentPage * DIRECTORY_PAGE_SIZE, results.length)} dari {results.length} penyedia</p>
        <Pagination current={currentPage} total={totalPages} onChange={(page) => { setState((previous) => ({ ...previous, page })); goToResults(); }} ariaLabel="Halaman penyedia API gratis" />
      </div>}
    </div>
  );
}
