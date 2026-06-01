import Link from "next/link";
import Spark from "./Spark";

const NAV_LINKS = [
  { label: "Direktori", href: "/#direktori" },
  { label: "Cara kerja", href: "/#cara-kerja" },
  { label: "Sumber", href: "/#sumber" },
];

export default function Navbar() {
  return (
    <header className="sticky top-3 z-50 px-4">
      <nav
        aria-label="Navigasi utama"
        className="mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full border border-ink-line bg-ink-soft/90 px-3 py-2 pl-5 shadow-[0_8px_30px_rgba(17,24,28,0.06)] backdrop-blur"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Spark className="h-4 w-4 text-fog" />
          <span className="font-serif text-lg font-medium tracking-tight text-fog">
            tokengratis<span className="text-mute">.id</span>
          </span>
        </Link>

        {/* Center links */}
        <div className="hidden items-center gap-6 text-sm font-medium text-mute md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-fog"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <span className="hidden text-base sm:inline" aria-hidden>
            🇮🇩
          </span>
          <Link
            href="/#direktori"
            className="rounded-full bg-ember px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-ember-soft"
          >
            Lihat direktori
          </Link>
        </div>
      </nav>
    </header>
  );
}
