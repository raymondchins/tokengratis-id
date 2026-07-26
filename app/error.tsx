"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level error boundary. Sebelum ini ga ada sama sekali — throw apa pun
 * di page/segment nampilin layar default Next yang ga di-style dan bahasa
 * Inggris. Sengaja ga nampilin error.message ke user (bisa bocorin detail
 * internal); message-nya tetap di-log ke console buat debugging.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="mx-auto max-w-5xl px-4 pt-20 sm:px-6 sm:pt-32"
    >
      <div className="flex flex-col items-center text-center">
        <p className="font-mono text-sm text-mute">Error</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-fog sm:text-5xl">
          Ada yang error di halaman ini
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-mute">
          Bukan salah kamu — ada yang rusak di sisi kami. Coba muat ulang dulu;
          kalau masih error, datanya kemungkinan lagi di-sync ulang.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-mute">
            Kode: {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-ember-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Coba lagi
          </button>
          <Link
            href="/#direktori"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-ink-line bg-ink-soft px-6 py-3 text-sm font-medium text-fog transition-colors hover:border-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40"
          >
            Kembali ke direktori
          </Link>
        </div>
      </div>
    </main>
  );
}
