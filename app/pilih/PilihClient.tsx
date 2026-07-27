"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "next-view-transitions";
import FilterBar from "@/components/FilterBar";
import ProviderLogo from "@/components/ProviderLogo";
import NoResultsPanel from "@/components/NoResultsPanel";
import EmptyDataPanel from "@/components/EmptyDataPanel";
import { MODALITY_ORDER, modalityLabel } from "@/components/directory/Badges";
import {
  CONTEXT_THRESHOLDS,
  emptyWizardCriteria,
  findWizardMatches,
  type ContextThreshold,
  type WizardCriteria,
  type WizardMatch,
  type WizardProvider,
} from "@/lib/wizard";
import type { Modality } from "@/lib/types";

// ─── Result card ──────────────────────────────────────────────────────────────

function MatchCard({ match, rank }: { match: WizardMatch; rank: number }) {
  return (
    <li className="flex flex-col gap-4 rounded-[8px] border border-ink-line bg-ink-soft p-5">
      <div className="flex items-start gap-3">
        <ProviderLogo
          logo={match.provider.logo}
          flag={match.provider.flag}
          name={match.provider.name}
          className="h-10 w-10"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex shrink-0 items-center rounded-full border border-grass-line bg-grass-bg px-2 py-0.5 text-[10px] font-semibold text-grass">
              #{rank}
            </span>
            <span className="truncate font-semibold text-fog">{match.provider.name}</span>
          </div>
          <p className="mt-0.5 truncate text-sm text-mute">{match.model.name}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-y border-ink-line py-3 text-xs text-mute">
        <span>
          Context:{" "}
          <span className="font-medium text-fog">{match.model.context ?? "tidak disebutkan"}</span>
        </span>
        <span>
          Rate limit:{" "}
          <span className="font-medium text-fog">{match.rateLimit.raw ?? "tidak disebutkan"}</span>
        </span>
      </div>

      <ul className="space-y-1.5 text-[13px] leading-relaxed text-fog">
        {match.reasons.map((r, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-0.5 shrink-0 text-grass">
              ✓
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ul>

      {match.tradeoffs.length > 0 && (
        <ul className="space-y-1 text-[12px] leading-relaxed text-mute">
          {match.tradeoffs.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="mt-0.5 shrink-0">
                –
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Sekunder, BUKAN hitam: 5 kartu = 5 tombol hitam ditumpuk, dan "satu
          aksi = satu hitam" (DESIGN.md) langsung ilang artinya. Sama persis
          sama treatment baris direktori.
          Label "Lihat" (bukan "Lihat provider") biar satu aksi = satu label di
          seluruh situs. Glyph "↗" DIBUANG — itu artinya keluar situs, padahal
          ini navigasi internal; diganti "→". */}
      <Link
        href={`/provider/${match.provider.slug}`}
        aria-label={`Lihat ${match.provider.name}`}
        className="mt-1 inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-[6px] border border-ink-line bg-ink-soft px-4 text-sm font-semibold text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
      >
        Lihat
        <span aria-hidden>→</span>
      </Link>
    </li>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export default function PilihClient({ providers }: { providers: WizardProvider[] }) {
  const [criteria, setCriteria] = useState<WizardCriteria>(emptyWizardCriteria());

  // Shareable/refresh-safe URL state — param `m` (modality), `ctx` (minContext).
  // State di atas tetap start dari default kosong biar server & client render
  // sama persis (no hydration mismatch); URL baru dibaca di effect ini pas
  // mount. Param invalid (modality/ctx yang ga dikenal) di-drop diam-diam —
  // link basi ga boleh bikin crash.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mParam = params.get("m");
    const ctxParam = params.get("ctx");

    setCriteria((prev) => {
      let next = prev;

      if (mParam && (MODALITY_ORDER as readonly string[]).includes(mParam)) {
        next = { ...next, modality: mParam as Modality };
      }

      if (ctxParam) {
        const parsed = Number(ctxParam);
        const validThreshold = CONTEXT_THRESHOLDS.find((t) => t.value === parsed);
        if (validThreshold) {
          next = { ...next, minContext: validThreshold.value };
        }
      }

      return next;
    });
  }, []);

  // Tulis balik kriteria ke URL (replaceState — ga nambah history entry tiap
  // klik chip). Skip run pertama biar ga nimpa hasil baca di effect di atas
  // sebelum state ke-hydrate dari URL.
  const skipFirstUrlWrite = useRef(true);
  useEffect(() => {
    if (skipFirstUrlWrite.current) {
      skipFirstUrlWrite.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (criteria.modality) params.set("m", criteria.modality);
    if (criteria.minContext) params.set("ctx", String(criteria.minContext));

    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [criteria]);

  /** SEMUA yang cocok (buat angka jujur), bukan yang udah kepotong. */
  const allMatches = useMemo(
    () => findWizardMatches(providers, criteria),
    [providers, criteria],
  );
  const SHOWN = 5;
  const matches = allMatches.slice(0, SHOWN);

  /** Link ke direktori dengan filter yang setara — biar sisa hasilnya kegapai. */
  const directoryHref = criteria.modality
    ? `/?m=${criteria.modality}#direktori`
    : "/#direktori";


  function setModality(m: Modality) {
    setCriteria((c) => ({ ...c, modality: c.modality === m ? null : m }));
  }

  function setMinContext(t: ContextThreshold) {
    setCriteria((c) => ({ ...c, minContext: c.minContext === t ? null : t }));
  }

  function reset() {
    setCriteria(emptyWizardCriteria());
  }

  if (providers.length === 0) {
    return (
      <EmptyDataPanel
        title="Direktori lagi dibangun"
        description="Pipeline sync nyusul — data provider lagi diproses."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Kriteria ──
          Pakai <FilterBar> bareng, sama kayak /, /modal-gratis, /opensource:
          urutan render, label grup, dan baris "N filter aktif · Reset" identik
          di semua permukaan. Audit nemu 5 daftar dengan 5 tata bahasa beda —
          nol yang dipelajari di satu halaman kepake di halaman lain.
          Dua grup di sini SINGLE-select (pilih modality lain = ganti, bukan
          nambah), jadi `selected` isinya 0 atau 1 id. */}
      <FilterBar
        chipGroups={[
          {
            id: "modality",
            label: "Kebutuhan kamu apa?",
            showLabel: true,
            options: MODALITY_ORDER.map((m) => ({ id: m, label: modalityLabel(m) })),
            selected: criteria.modality ? [criteria.modality] : [],
            onToggle: (id) => setModality(id as Modality),
          },
          {
            id: "context",
            label: "Context window minimum?",
            showLabel: true,
            options: CONTEXT_THRESHOLDS.map((t) => ({
              id: String(t.value),
              label: t.label,
            })),
            selected: criteria.minContext !== null ? [String(criteria.minContext)] : [],
            onToggle: (id) => setMinContext(Number(id) as ContextThreshold),
          },
        ]}
        activeCount={
          (criteria.modality ? 1 : 0) + (criteria.minContext !== null ? 1 : 0)
        }
        onReset={reset}
      />

      {/* ── Hasil ── */}
      <div aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="font-serif text-lg font-medium text-fog sm:text-xl">Rekomendasi</h2>
          {/* Angka JUJUR: yang ditampilin vs yang beneran cocok. Dulu di sini
              `matches.length` yang udah kepotong 5 dirender sebagai "N provider
              cocok" — jadi halaman bilang "5 provider cocok" padahal 11. */}
          {allMatches.length > 0 && (
            <span className="text-xs text-mute">
              {allMatches.length > SHOWN
                ? `Menampilkan ${SHOWN} teratas dari ${allMatches.length} yang cocok`
                : `${allMatches.length} provider cocok`}
            </span>
          )}
        </div>

        {/* Kriteria urutannya ditulis. Nomor #1 tanpa alasan itu KLAIM, dan
            situs ini jualannya kuitansi — bukan klaim. */}
        {allMatches.length > 0 && (
          <p className="mt-1 text-xs leading-relaxed text-mute">
            Diurutkan dari rate limit paling longgar &amp; context terbesar{" "}
            <span className="text-fog">menurut yang ditulis sumber</span> — bukan
            hasil tes kita.
          </p>
        )}

        <div className="mt-4">
          {matches.length === 0 ? (
            <div className="overflow-hidden rounded-[8px] border border-ink-line bg-ink-soft">
              <NoResultsPanel
                message="Ga ada model yang cocok sama kriteria ini."
                hint="Coba longgarin context minimum, atau ganti kebutuhan."
                onReset={reset}
              />
            </div>
          ) : (
            // grid-cols-[minmax(0,1fr)] wajib di base: grid item default
            // min-width:auto, jadi track ke-resolve ke min-content kartu
            // (379px) di container 343px → halaman scroll horizontal di HP.
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
              {matches.map((match, i) => (
                <MatchCard key={`${match.provider.slug}-${match.model.id}`} match={match} rank={i + 1} />
              ))}
            </ul>
          )}
        </div>

        {/* Jalan keluar ke sisa hasil. Tanpa ini cap 5 itu jadi jalan buntu:
            user ga tau ada 6 lagi, apalagi cara nyampe ke sana. */}
        {allMatches.length > SHOWN && (
          <Link
            href={directoryHref}
            className="mt-6 inline-flex min-h-[44px] items-center gap-1.5 rounded-[6px] px-3 text-sm font-medium text-fog underline decoration-ink-line underline-offset-2 transition-colors hover:decoration-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
          >
            Lihat semua {allMatches.length} di direktori
            <span aria-hidden>→</span>
          </Link>
        )}

        {/* Tombol "Reset semua filter" yang dulu di sini DIBUANG — FilterBar
            bareng udah render "N filter aktif · Reset" di atas, dan dua kontrol
            reset buat satu kerjaan itu persis inkonsistensi yang lagi dibenerin. */}
      </div>
    </div>
  );
}
