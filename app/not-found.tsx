import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function NotFound() {
  return (
    <div className="min-h-dvh pb-24">
      <Navbar />
      <main
        id="main-content"
        className="mx-auto max-w-5xl px-4 pt-20 sm:px-6 sm:pt-32"
      >
        <div className="flex flex-col items-center text-center">
          <p className="font-mono text-sm text-mute">404</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-fog sm:text-4xl">
            Halaman ga ketemu
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-mute">
            URL ini ga ada atau udah berubah. Data di-sync tiap malam dari sumber
            komunitas, jadi slug provider bisa berubah kalau namanya ikut diupdate
            di upstream.
          </p>
          <Link
            href="/#direktori"
            className="mt-8 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[6px] bg-ember px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ember-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Kembali ke direktori
          </Link>
        </div>
      </main>
    </div>
  );
}
