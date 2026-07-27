"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Link } from "next-view-transitions";
import Spark from "./Spark";

// Nav muat 4 link: di >=md tampil langsung di pill (md:flex), di bawah itu
// disembunyikan ke belakang tombol hamburger biar ga ada link (khususnya
// /opensource) yang jadi dead-end di mobile. Anchor homepage "Cara
// kerja"/"Sumber" pindah ke baris "Alat & jelajah" di Footer — masih
// ke-crawl dari semua halaman, tapi slot nav kepake buat halaman beneran.
const NAV_LINKS: { label: string; href: string; badge?: string }[] = [
  { label: "Direktori", href: "/#direktori" },
  { label: "Pilih model", href: "/pilih" },
  { label: "Modal gratis", href: "/modal-gratis", badge: "NEW" },
  { label: "Open source", href: "/opensource" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70";

/** Exact match untuk root path (mis. "/#direktori" -> "/"), prefix match buat
 * sub-route (mis. "/modal-gratis/slug" tetep nge-active-in "Modal gratis"). */
function isNavLinkActive(pathname: string, href: string): boolean {
  const path = href.split("#")[0] || "/";
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function Navbar() {
  const pathname = usePathname();
  // Di "/" tombol cuma scroll ke #direktori yang udah di layar — CTA hitam
  // di situ jadi elemen paling kontras buat aksi yang paling ga penting
  // (One Black Rule kepake buat row directory, bukan buat no-op ini).
  // Di route lain klik ini beneran mindahin ke halaman lain, jadi hitam
  // masih layak dipertahanin.
  const isHome = pathname === "/";
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Tutup menu tiap pindah halaman (jaga-jaga kalau close-on-click ke-skip,
  // mis. navigasi via keyboard/back-forward).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside click + Escape. Listener cuma nempel selama menu open,
  // dan selalu di-cleanup pas unmount/close.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <header className="sticky top-3 z-50 px-4">
      <nav
        aria-label="Navigasi utama"
        className="mx-auto flex max-w-5xl items-center justify-between gap-2 rounded-full border border-ink-line bg-ink-soft/95 px-2 py-2 pl-3 shadow-[0_8px_30px_rgba(17,24,28,0.06)] backdrop-blur sm:gap-4 sm:px-3 sm:pl-5"
      >
        {/* Logo */}
        <Link href="/" className="flex min-h-[44px] items-center gap-2">
          <Spark className="h-4 w-4 text-fog" />
          <span className="font-serif text-base font-medium tracking-tight text-fog sm:text-lg">
            tokengratis<span className="text-mute">.id</span>
          </span>
        </Link>

        {/* Center links */}
        <div className="hidden items-center gap-6 text-sm font-medium text-mute md:flex">
          {NAV_LINKS.map((l) => {
            const active = isNavLinkActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-sm transition-colors hover:text-fog lg:min-h-0 lg:py-1 ${FOCUS_RING} ${
                  active ? "text-fog" : ""
                }`}
              >
                {l.label}
                {l.badge && (
                  <span className="inline-flex items-center rounded-full border border-grass-line bg-grass-bg px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-grass">
                    {l.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>
            🇮🇩
          </span>
          <Link
            href="/#direktori"
            className={`flex min-h-[44px] items-center rounded-full px-3 py-1.5 text-sm font-semibold transition-colors sm:px-4 ${FOCUS_RING} ${
              isHome
                ? "border border-ink-line bg-ink-soft text-fog hover:border-mute"
                : "bg-ember text-white hover:bg-ember-soft"
            }`}
          >
            Lihat direktori
          </Link>

          {/* Hamburger — cuma tampil di bawah md, di mana center links ke-hidden */}
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Tutup menu" : "Buka menu"}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-fog transition-colors hover:bg-ink md:hidden ${FOCUS_RING}`}
          >
            {open ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu panel — sibling of the pill <nav>, NOT nested inside it.
          The pill is rounded-full + backdrop-blur (its own stacking context),
          so an absolutely-positioned child risks getting clipped by the
          rounding. Rendering it here, below the pill, sidesteps that. */}
      {/* Di-MOUNT/UNMOUNT, bukan di-toggle lewat class visibility/max-height.
          Versi sebelumnya pakai `invisible max-h-0 opacity-0` ↔ `visible
          max-h-96 opacity-100`: class-nya kebalik dengan bener tapi computed
          style-nya nyangkut di ketutup, jadi menu-nya GA PERNAH kebuka di
          production. Gating konten di balik transisi class emang rapuh —
          mount langsung ga bisa gagal kayak gitu, plus pas ketutup panel-nya
          beneran ilang dari a11y tree & urutan tab (bukan cuma ke-hide). */}
      {open && (
        <div
          id={menuId}
          ref={panelRef}
          className="mx-auto mt-2 max-w-5xl overflow-hidden rounded-[8px] border border-ink-line bg-ink-soft shadow-[0_8px_30px_rgba(17,24,28,0.06)] md:hidden"
        >
          <ul className="divide-y divide-ink-line p-2 text-sm font-medium text-mute">
            {NAV_LINKS.map((l) => {
              const active = isNavLinkActive(pathname, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-[44px] items-center justify-between gap-1.5 rounded-sm px-3 transition-colors hover:text-fog ${FOCUS_RING} ${
                      active ? "text-fog" : ""
                    }`}
                  >
                    {l.label}
                    {l.badge && (
                      <span className="inline-flex items-center rounded-full border border-grass-line bg-grass-bg px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-grass">
                        {l.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </header>
  );
}
