"use client";

import { useEffect, useRef, useState } from "react";
import type { Provider } from "@/lib/types";
import { getProviderSetup, type SnippetTargetId } from "@/lib/snippets";

// Panel "Setup dalam 5 menit" — pure presentation di atas data yang UDAH ada
// (provider.baseUrl, provider.models, provider.url). Ga ada base URL / model
// id yang di-generate, semua lewat lib/snippets.ts yang validasi ke data asli.
//
// Kalau `provider.baseUrl` null, sumber ga nyediain base URL terstruktur —
// panel ini nampilin honest fallback (bukan ngarang) + link ke provider.url.

type CopyTarget = "code" | "env";

export default function SetupPanel({ provider }: { provider: Provider }) {
  const firstModelId = provider.models[0]?.id ?? "";
  const [modelId, setModelId] = useState(firstModelId);
  const [target, setTarget] = useState<SnippetTargetId>("openai-node");
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [copyFailed, setCopyFailed] = useState<CopyTarget | null>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    };
  }, []);

  function handleCopy(which: CopyTarget, text: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(which);
        setCopyFailed(null);
        if (copyTimeout.current) clearTimeout(copyTimeout.current);
        copyTimeout.current = setTimeout(() => setCopied(null), 1600);
      },
      () => {
        // Clipboard ditolak browser/permission. Dulu di-diemin — tombol
        // keliatan "ga ngapa-ngapain" dan user ga tau harus copy manual.
        setCopied(null);
        setCopyFailed(which);
        if (copyTimeout.current) clearTimeout(copyTimeout.current);
        copyTimeout.current = setTimeout(() => setCopyFailed(null), 4000);
      },
    );
  }

  // Ga ada model sama sekali — seharusnya ga kejadian (provider 0-model
  // di-drop di pipeline), tapi jaga-jaga aja daripada nampilin panel kosong.
  if (provider.models.length === 0) return null;

  const setup = getProviderSetup(provider, modelId);

  return (
    <section className="rounded-[8px] border border-ink-line bg-ink-soft px-5 py-4">
      {!provider.baseUrl || !setup ? (
        <p className="text-sm leading-relaxed text-mute">
          Sumber belum menyediakan base URL API buat {provider.name}, jadi
          kita ga bisa kasih snippet siap pakai — daripada ngarang.
          {provider.url && (
            <>
              {" "}
              Cek langsung ke{" "}
              <a
                href={provider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-ink-line underline-offset-2 hover:text-fog"
              >
                halaman resmi {provider.name} ↗
              </a>
              .
            </>
          )}
        </p>
      ) : (
        <div className="space-y-3.5">
          {/* model selector */}
          {provider.models.length > 1 && (
            <div>
              <label
                htmlFor="setup-model"
                className="mb-1.5 block text-xs font-medium text-mute"
              >
                Model
              </label>
              <select
                id="setup-model"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full min-h-[44px] rounded-[4px] border border-ink-line bg-ink px-3 py-1.5 text-xs text-fog focus-visible:border-fog/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 sm:w-auto sm:min-w-[240px]"
              >
                {provider.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* target tabs */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilih target snippet">
            {setup.snippets.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={target === s.id}
                onClick={() => setTarget(s.id)}
                className={`min-h-[44px] rounded-[4px] border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 ${
                  target === s.id
                    ? "border-ember bg-ember text-white active:bg-ember-soft"
                    : "border-ink-line bg-ink text-fog hover:border-mute active:bg-ink-line/60"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* code block */}
          {(() => {
            const active =
              setup.snippets.find((s) => s.id === target) ?? setup.snippets[0];
            return (
              <div className="relative">
                <pre className="overflow-x-auto rounded-[6px] border border-ink-line bg-ink px-4 py-3.5 pr-20 font-mono text-[12px] leading-relaxed text-fog">
                  <code>{active.code}</code>
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopy("code", active.code)}
                  className="absolute right-2 top-2 min-h-[44px] rounded-[4px] border border-ink-line bg-ink-soft px-2.5 text-[11px] font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 active:bg-ink-line/60"
                >
                  <span role="status">
                    {copied === "code"
                      ? "Tersalin"
                      : copyFailed === "code"
                        ? "Gagal — salin manual"
                        : "Salin"}
                  </span>
                </button>
              </div>
            );
          })()}

          {/* .env block */}
          <div className="rounded-[6px] border border-ink-line bg-ink px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-mute">
                .env
              </span>
              <button
                type="button"
                onClick={() => handleCopy("env", setup.envSnippet)}
                className="min-h-[44px] rounded-[4px] border border-ink-line bg-ink-soft px-2.5 text-[11px] font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 active:bg-ink-line/60"
              >
                <span role="status">
                  {copied === "env"
                    ? "Tersalin"
                    : copyFailed === "env"
                      ? "Gagal — salin manual"
                      : "Salin"}
                </span>
              </button>
            </div>
            <pre className="mt-1.5 overflow-x-auto font-mono text-[12px] text-fog">
              <code>{setup.envSnippet}</code>
            </pre>
          </div>

          {/* where to get the key */}
          {provider.url && (
            <p className="text-xs text-mute">
              Belum punya API key? Ambil di{" "}
              <a
                href={provider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-ink-line underline-offset-2 hover:text-fog"
              >
                halaman resmi {provider.name} ↗
              </a>
              .
            </p>
          )}
        </div>
      )}
    </section>
  );
}
