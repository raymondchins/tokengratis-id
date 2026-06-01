"use client";

import { useState } from "react";

/**
 * Logo provider dari favicon service. Fallback ke flag emoji kalau gambar gagal
 * load (favicon ga ada / diblok). Dipakai di tabel direktori + halaman detail.
 */
export default function ProviderLogo({
  logo,
  flag,
  name,
  className = "h-9 w-9",
}: {
  logo: string | null;
  flag: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink-line bg-ink-soft ${className}`}
    >
      {logo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={`${name} logo`}
          className="h-2/3 w-2/3 object-contain"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden className="text-base">
          {flag}
        </span>
      )}
    </div>
  );
}
