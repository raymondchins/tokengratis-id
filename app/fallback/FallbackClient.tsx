"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  MIN_CHAIN_LENGTH,
  MAX_CHAIN_LENGTH,
  generateVercelAiSdk,
  generateLiteLLMConfig,
  generateTypeScriptFallback,
  generateEnvFile,
  type ChainStep,
  type FallbackProvider,
} from "@/lib/fallback";
import EmptyDataPanel from "@/components/EmptyDataPanel";

// ─── Output tabs ────────────────────────────────────────────────────────────

type TabKey = "sdk" | "litellm" | "ts" | "env";

const TABS: { key: TabKey; label: string; generate: (chain: ChainStep[]) => string }[] = [
  { key: "sdk", label: "Vercel AI SDK", generate: generateVercelAiSdk },
  { key: "litellm", label: "LiteLLM", generate: generateLiteLLMConfig },
  { key: "ts", label: "TypeScript", generate: generateTypeScriptFallback },
  { key: "env", label: ".env", generate: generateEnvFile },
];

// ─── Selection type (client-side state) ────────────────────────────────────

interface Selection {
  slug: string;
  modelId: string;
}

export default function FallbackClient({ providers }: { providers: FallbackProvider[] }) {
  const providerBySlug = useMemo(() => {
    const map = new Map<string, FallbackProvider>();
    for (const p of providers) map.set(p.slug, p);
    return map;
  }, [providers]);

  const [selections, setSelections] = useState<Selection[]>(() =>
    providers.slice(0, Math.min(2, providers.length)).map((p) => ({
      slug: p.slug,
      modelId: p.models[0]?.id ?? "",
    })),
  );
  const [activeTab, setActiveTab] = useState<TabKey>("sdk");
  const [copiedTab, setCopiedTab] = useState<TabKey | null>(null);
  const [copyFailedTab, setCopyFailedTab] = useState<TabKey | null>(null);

  const chain: ChainStep[] = useMemo(
    () =>
      selections
        .map((s) => {
          const provider = providerBySlug.get(s.slug);
          if (!provider) return null;
          return {
            slug: provider.slug,
            name: provider.name,
            baseUrl: provider.baseUrl,
            modelId: s.modelId,
          };
        })
        .filter((s): s is ChainStep => s !== null),
    [selections, providerBySlug],
  );

  const availableToAdd = useMemo(
    () => providers.filter((p) => !selections.some((s) => s.slug === p.slug)),
    [providers, selections],
  );

  const canAdd = selections.length < MAX_CHAIN_LENGTH && availableToAdd.length > 0;
  const canRemove = selections.length > MIN_CHAIN_LENGTH;
  const isValidChain = chain.length >= MIN_CHAIN_LENGTH;

  function addProvider(slug: string) {
    const provider = providerBySlug.get(slug);
    if (!provider || selections.length >= MAX_CHAIN_LENGTH) return;
    setSelections((prev) => [...prev, { slug, modelId: provider.models[0]?.id ?? "" }]);
  }

  function removeProvider(index: number) {
    if (!canRemove) return;
    setSelections((prev) => prev.filter((_, i) => i !== index));
  }

  function moveProvider(index: number, direction: -1 | 1) {
    setSelections((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  }

  function setModel(index: number, modelId: string) {
    setSelections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, modelId } : s)),
    );
  }

  async function handleCopy(tab: TabKey, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTab(tab);
      setCopyFailedTab(null);
      window.setTimeout(() => {
        setCopiedTab((t) => (t === tab ? null : t));
      }, 1600);
    } catch {
      // Clipboard permission ditolak / API ga tersedia. Dulu di-diemin —
      // tombol keliatan ga ngapa-ngapain, user ga tau harus copy manual.
      setCopiedTab(null);
      setCopyFailedTab(tab);
      window.setTimeout(() => {
        setCopyFailedTab((t) => (t === tab ? null : t));
      }, 4000);
    }
  }

  // Shareable/refresh-safe URL state — param `chain` (comma-separated
  // providerSlug:modelId, urutan = prioritas) dan `tab`. State di atas tetap
  // start dari default (2 provider pertama + tab "sdk") biar server & client
  // render sama persis (no hydration mismatch); URL baru dibaca di effect ini
  // pas mount. Pair yang slug/model-nya ga dikenal (provider dihapus, model id
  // basi) di-drop diam-diam — link basi ga boleh bikin crash.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const chainParam = params.get("chain");
    if (chainParam) {
      const seenSlugs = new Set<string>();
      const parsed: Selection[] = [];

      for (const pair of chainParam.split(",")) {
        const [slug, modelId] = pair.split(":");
        if (!slug || !modelId || seenSlugs.has(slug)) continue;

        const provider = providerBySlug.get(slug);
        if (!provider || !provider.models.some((m) => m.id === modelId)) continue;

        seenSlugs.add(slug);
        parsed.push({ slug, modelId });
        if (parsed.length >= MAX_CHAIN_LENGTH) break;
      }

      if (parsed.length > 0) setSelections(parsed);
    }

    const tabParam = params.get("tab");
    if (tabParam && TABS.some((t) => t.key === tabParam)) {
      setActiveTab(tabParam as TabKey);
    }
  }, []);

  // Tulis balik state ke URL (replaceState — ga nambah history entry tiap
  // klik). Skip run pertama biar ga nimpa hasil baca di effect di atas
  // sebelum state ke-hydrate dari URL.
  const skipFirstUrlWrite = useRef(true);
  useEffect(() => {
    if (skipFirstUrlWrite.current) {
      skipFirstUrlWrite.current = false;
      return;
    }

    const params = new URLSearchParams();

    const chainStr = selections
      .filter((s) => s.modelId)
      .map((s) => `${s.slug}:${s.modelId}`)
      .join(",");
    if (chainStr) params.set("chain", chainStr);
    if (activeTab !== "sdk") params.set("tab", activeTab);

    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [selections, activeTab]);

  // Roving focus buat tablist (WAI-ARIA tabs pattern) — Left/Right pindah
  // fokus antar tab (wrap-around) sekaligus ngaktifin tab tujuan.
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();

    const dir = e.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + dir + TABS.length) % TABS.length;
    setActiveTab(TABS[nextIndex].key);
    tabRefs.current[nextIndex]?.focus();
  }

  if (providers.length === 0) {
    return (
      <EmptyDataPanel
        title="Belum ada provider yang bisa dipilih"
        description="Ga ada provider di direktori yang punya base URL API terstruktur saat ini."
      />
    );
  }

  const activeGenerate = TABS.find((t) => t.key === activeTab)?.generate ?? generateVercelAiSdk;
  const activeCode = isValidChain ? activeGenerate(chain) : "";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Chain builder ── */}
      <div className="rounded-[8px] border border-ink-line bg-ink-soft p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-serif text-lg font-medium text-fog">Rantai provider</h3>
          <span className="text-xs text-mute">
            {selections.length}/{MAX_CHAIN_LENGTH} provider
          </span>
        </div>

        <ol className="mt-4 flex flex-col gap-2.5">
          {selections.map((s, i) => {
            const provider = providerBySlug.get(s.slug);
            if (!provider) return null;
            return (
              <li
                key={`${s.slug}-${i}`}
                className="flex flex-col gap-2.5 rounded-[6px] border border-ink-line bg-ink px-3 py-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ember text-[11px] font-semibold text-white"
                >
                  {i + 1}
                </span>

                <span className="min-w-0 flex-1 truncate text-sm font-medium text-fog">
                  {provider.name}
                </span>

                <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-mute">
                  <span className="sr-only">Model buat {provider.name}</span>
                  <select
                    value={s.modelId}
                    onChange={(e) => setModel(i, e.target.value)}
                    className="min-h-[44px] w-full min-w-0 rounded-[4px] border border-ink-line bg-ink-soft px-2.5 py-1.5 text-[13px] font-medium text-fog transition-colors hover:border-mute focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
                  >
                    {provider.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex shrink-0 items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => moveProvider(i, -1)}
                    disabled={i === 0}
                    aria-label={`Naikkan prioritas ${provider.name}`}
                    className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-ink-line bg-ink-soft text-sm text-mute transition-colors hover:border-mute hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveProvider(i, 1)}
                    disabled={i === selections.length - 1}
                    aria-label={`Turunkan prioritas ${provider.name}`}
                    className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-ink-line bg-ink-soft text-sm text-mute transition-colors hover:border-mute hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProvider(i)}
                    disabled={!canRemove}
                    aria-label={`Hapus ${provider.name} dari rantai`}
                    className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-ink-line bg-ink-soft text-sm text-mute transition-colors hover:border-mute hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        {!canRemove && (
          <p className="mt-2.5 text-[11px] text-mute">
            Minimal {MIN_CHAIN_LENGTH} provider buat bikin rantai fallback.
          </p>
        )}

        {canAdd && (
          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm text-mute">
              <span className="sr-only">Tambah provider ke rantai</span>
              <select
                defaultValue=""
                onChange={(e) => {
                  const slug = e.target.value;
                  if (slug) addProvider(slug);
                  e.target.value = "";
                }}
                className="min-h-[44px] w-full rounded-[6px] border border-dashed border-ink-line bg-ink px-3 py-2.5 text-sm font-medium text-mute transition-colors hover:border-mute hover:text-fog focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
              >
                <option value="" disabled>
                  + Tambah provider
                </option>
                {availableToAdd.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {/* ── Output ── */}
      <div className="rounded-[8px] border border-ink-line bg-ink-soft">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-line px-3 py-2.5 sm:px-4">
          <div className="-mx-1 flex flex-wrap items-center gap-1 px-1" role="tablist" aria-label="Format config">
            {TABS.map((t, i) => (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                id={`fallback-tab-${t.key}`}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                aria-controls="fallback-output-panel"
                tabIndex={activeTab === t.key ? 0 : -1}
                onClick={() => setActiveTab(t.key)}
                onKeyDown={(e) => handleTabKeyDown(e, i)}
                className={[
                  "inline-flex min-h-[44px] items-center justify-center rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70",
                  activeTab === t.key
                    ? "bg-ember text-white"
                    : "text-mute hover:bg-ink hover:text-fog",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleCopy(activeTab, activeCode)}
            disabled={!isValidChain}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[6px] bg-ember px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-ember-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span role="status">
              {copiedTab === activeTab
                ? "Tersalin"
                : copyFailedTab === activeTab
                  ? "Gagal — salin manual"
                  : "Salin"}
            </span>
          </button>
        </div>

        <div
          id="fallback-output-panel"
          role="tabpanel"
          aria-labelledby={`fallback-tab-${activeTab}`}
          tabIndex={0}
          className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 focus-visible:ring-inset"
        >
          {isValidChain ? (
            <pre className="min-w-max px-4 py-4 text-[12.5px] leading-relaxed text-fog sm:px-5">
              <code>{activeCode}</code>
            </pre>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-mute sm:px-5">
              Pilih minimal {MIN_CHAIN_LENGTH} provider dulu buat generate config.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
