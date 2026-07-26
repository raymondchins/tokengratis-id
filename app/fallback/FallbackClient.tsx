"use client";

import { useMemo, useState } from "react";
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
                    className="w-full min-w-0 rounded-[4px] border border-ink-line bg-ink-soft px-2.5 py-1.5 text-[13px] font-medium text-fog transition-colors hover:border-mute focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40"
                  >
                    {provider.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex shrink-0 items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => moveProvider(i, -1)}
                    disabled={i === 0}
                    aria-label={`Naikkan prioritas ${provider.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-ink-line bg-ink-soft text-sm text-mute transition-colors hover:border-mute hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveProvider(i, 1)}
                    disabled={i === selections.length - 1}
                    aria-label={`Turunkan prioritas ${provider.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-ink-line bg-ink-soft text-sm text-mute transition-colors hover:border-mute hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProvider(i)}
                    disabled={!canRemove}
                    aria-label={`Hapus ${provider.name} dari rantai`}
                    className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-ink-line bg-ink-soft text-sm text-mute transition-colors hover:border-mute hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 disabled:cursor-not-allowed disabled:opacity-30"
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
                className="w-full rounded-[6px] border border-dashed border-ink-line bg-ink px-3 py-2.5 text-sm font-medium text-mute transition-colors hover:border-mute hover:text-fog focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40"
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
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => setActiveTab(t.key)}
                className={[
                  "rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70",
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
            className="shrink-0 rounded-[6px] bg-ember px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-ember-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 disabled:cursor-not-allowed disabled:opacity-40"
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

        <div className="overflow-x-auto">
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
