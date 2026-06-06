"use client";

import { useState, useEffect } from "react";

/**
 * Logo provider dari favicon service. Fallback ke flag emoji kalau gambar gagal
 * load (favicon ga ada / diblok). Dipakai di tabel direktori + halaman detail.
 */
export default function ProviderLogo({
  logo,
  flag,
  name,
  className = "h-9 w-9",
  priority = false,
}: {
  logo: string | null;
  flag: string | null;
  name: string;
  className?: string;
  /** Above-fold logo → eager-load + high fetch priority (LCP). Default lazy. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [logo]);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-ink-line bg-ink-soft ${className}`}
    >
      {logo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={`Logo ${name}`}
          width={64}
          height={64}
          className="h-2/3 w-2/3 object-contain"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : undefined}
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden className="text-base">
          {flag ?? "🌐"}
        </span>
      )}
    </div>
  );
}
