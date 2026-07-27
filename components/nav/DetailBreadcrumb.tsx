"use client";

// Breadcrumb halaman detail (/provider/[slug] & /model/[slug]) — sekaligus
// SATU-SATUNYA jalan balik di halaman itu. Sebelumnya ada 2 kata beda
// ("Kembali ke direktori" vs "Kembali ke beranda") yang dua-duanya nunjuk ke
// "/" polos, jadi balik = filter + pencarian user hangus dan mendarat di puncak
// halaman 9 layar.
//
// Client component TAPI rutenya tetep ○ Static: yang bikin dynamic itu
// useSearchParams, bukan "use client". Polanya nyontek DirectoryClient (lihat
// WHY 2026-07-27 di docs/log.md): state start dari default biar HTML server &
// render client pertama identik, URL baru dibaca di effect pas mount.

import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { Link } from "next-view-transitions";

/** Kalau URL direktori sebelumnya ga ketauan, minimal mendarat di seksinya. */
const FALLBACK_HREF = "/#direktori";

/** Bentuk minimal Navigation API — belum ada di lib.dom TS, dan kita cuma
 *  butuh daftar entry + posisi sekarang. */
interface NavigationEntryLike {
  url?: string;
}
interface NavigationLike {
  currentEntry?: { index?: number } | null;
  entries?: () => NavigationEntryLike[];
}

interface Previous {
  href: string;
  /** true = entry-nya beneran ada di history, jadi history.back() bisa dipake
   *  dan posisi scroll ikut balik (bukan cuma filternya). */
  pop: boolean;
}

/** Balikin href direktori kalau `raw` emang halaman itu, else null. Param
 *  ga divalidasi di sini — DirectoryClient udah validasi tiap param waktu baca,
 *  param basi di-drop diem-diem di sana. */
function directoryHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw, window.location.href);
  } catch {
    return null;
  }
  if (u.origin !== window.location.origin) return null;
  if (u.pathname !== "/") return null;
  return `/${u.search}#direktori`;
}

function readPrevious(): Previous | null {
  // (1) Navigation API — SATU-SATUNYA cara tau entry sebelumnya kalau user
  //     dateng lewat client-side nav, karena pushState ga nge-update
  //     document.referrer. Ini jalur perjalanan utama (klik dari direktori).
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  const index = nav?.currentEntry?.index;
  if (nav?.entries && typeof index === "number" && index > 0) {
    const href = directoryHref(nav.entries()[index - 1]?.url);
    if (href) return { href, pop: true };
  }
  // (2) Hard navigation (tab baru / reload): referrer masih akurat, dan
  //     Referrer-Policy strict-origin-when-cross-origin ngirim query UTUH
  //     buat navigasi same-origin.
  const href = directoryHref(document.referrer);
  return href ? { href, pop: false } : null;
}

export default function DetailBreadcrumb({ current }: { current: string }) {
  const [prev, setPrev] = useState<Previous | null>(null);

  useEffect(() => {
    setPrev(readPrevious());
  }, []);

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!prev?.pop) return;
    // Jangan bajak cmd/ctrl/shift-klik & klik tengah — itu "buka di tab baru".
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    window.history.back();
  }

  return (
    <nav aria-label="Breadcrumb" className="-mx-2 mb-6 sm:mb-8">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs">
        <li className="min-w-0">
          <Link
            href={prev?.href ?? FALLBACK_HREF}
            onClick={onClick}
            className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] px-2 text-mute transition-colors hover:text-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70"
          >
            <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            Direktori
          </Link>
        </li>
        <li aria-hidden className="text-mute">
          /
        </li>
        <li aria-current="page" className="min-w-0 truncate px-1 font-medium text-fog">
          {current}
        </li>
      </ol>
    </nav>
  );
}
