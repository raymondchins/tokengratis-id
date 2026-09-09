"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Link } from "next-view-transitions";
import Spark from "./Spark";

const MORE_LINKS = [
  { label: "Pilih model", href: "/pilih" },
  { label: "Rantai fallback", href: "/fallback" },
  { label: "Modal gratis", href: "/modal-gratis" },
  { label: "Open source", href: "/opensource" },
  { label: "Perubahan data", href: "/changelog" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 focus-visible:ring-offset-2";

function isNavLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const disclosureRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inDirectory = pathname === "/" || ["/provider", "/model", "/gratis"].some(
    (route) => isNavLinkActive(pathname, route),
  );
  const inMore = MORE_LINKS.some((link) => isNavLinkActive(pathname, link.href));

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!disclosureRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
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
    <header className="sticky top-0 z-50 border-b border-ink-line bg-ink-soft">
      <nav
        aria-label="Navigasi utama"
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 px-4 py-2 sm:flex-nowrap sm:px-6 sm:py-3"
      >
        <Link href="/" className={`flex min-h-11 items-center gap-2 rounded-sm ${FOCUS_RING}`}>
          <Spark className="h-5 w-5 text-fog" />
          <span className="font-serif text-xl font-medium tracking-tight text-fog">
            tokengratis<span className="text-mute">.id</span>
          </span>
        </Link>

        <div className="flex w-full items-center justify-between gap-2 text-sm font-medium sm:w-auto sm:justify-end sm:gap-5">
          <Link
            href="/#direktori"
            aria-current={inDirectory ? "location" : undefined}
            onClick={() => setOpen(false)}
            className={`inline-flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-fog ${FOCUS_RING} ${inDirectory ? "text-fog" : "text-mute"}`}
          >
            Cari token
          </Link>
          <Link
            href="/#cara-kerja"
            onClick={() => setOpen(false)}
            className={`inline-flex min-h-11 items-center rounded-sm px-1 text-mute transition-colors hover:text-fog ${FOCUS_RING}`}
          >
            Cara pakai
          </Link>
          <div
            ref={disclosureRef}
            className="relative"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
            }}
          >
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls={menuId}
              className={`inline-flex min-h-11 items-center gap-2 rounded-sm px-1 transition-colors hover:text-fog ${FOCUS_RING} ${inMore || open ? "text-fog" : "text-mute"}`}
            >
              Lainnya
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-4 w-4 ${open ? "rotate-180" : ""}`} aria-hidden="true">
                <path d="m4 6 4 4 4-4" />
              </svg>
            </button>
            {open && (
              <div id={menuId} className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-ink-line bg-ink-soft p-2">
                <ul>
                  {MORE_LINKS.map((link) => {
                    const active = isNavLinkActive(pathname, link.href);
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => {
                            setOpen(false);
                            buttonRef.current?.focus();
                          }}
                          className={`flex min-h-11 items-center rounded-lg px-3 transition-colors hover:bg-ink hover:text-fog ${FOCUS_RING} ${active ? "bg-ink text-fog" : "text-mute"}`}
                        >
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
