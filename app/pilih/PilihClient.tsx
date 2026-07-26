"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "next-view-transitions";
import Chip from "@/components/Chip";
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

      <Link
        href={`/provider/${match.provider.slug}`}
        className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-[6px] bg-ember px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ember-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
      >
        Lihat provider
        <span aria-hidden>↗</span>
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

  const matches = useMemo(() => findWizardMatches(providers, criteria, 5), [providers, criteria]);

  const isFiltered = criteria.modality !== null || criteria.minContext !== null;

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
      {/* ── Kriteria ── */}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-mute">
            Kebutuhan kamu apa?
          </h2>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter modality">
            <Chip active={criteria.modality === null} onClick={() => setCriteria((c) => ({ ...c, modality: null }))}>
              Semua
            </Chip>
            {MODALITY_ORDER.map((m) => (
              <Chip key={m} active={criteria.modality === m} onClick={() => setModality(m)}>
                {modalityLabel(m)}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-mute">
            Context window minimum?
          </h2>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter context minimum">
            <Chip
              active={criteria.minContext === null}
              onClick={() => setCriteria((c) => ({ ...c, minContext: null }))}
            >
              Semua
            </Chip>
            {CONTEXT_THRESHOLDS.map((t) => (
              <Chip key={t.value} active={criteria.minContext === t.value} onClick={() => setMinContext(t.value)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hasil ── */}
      <div aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-lg font-medium text-fog sm:text-xl">Rekomendasi</h2>
          {matches.length > 0 && (
            <span className="text-xs text-mute">{matches.length} provider cocok</span>
          )}
        </div>

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

        {isFiltered && matches.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex min-h-[44px] items-center rounded-[6px] px-3 text-sm font-medium text-mute underline decoration-ink-line underline-offset-2 transition-colors hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
          >
            Reset semua filter
          </button>
        )}
      </div>
    </div>
  );
}
