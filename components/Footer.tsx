import { getSources } from "@/lib/data";
import SocialIcons from "@/components/SocialIcons";

/**
 * Footer global (mount di app/layout.tsx → muncul di semua page).
 * Atribusi sumber otomatis dari getSources() — ikut berapapun sumber ke-wire.
 * id="sumber" = target anchor nav "Sumber".
 */
export default function Footer() {
  const sources = getSources();

  return (
    <footer
      id="sumber"
      className="mt-16 border-t border-ink-line scroll-mt-20"
    >
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-mute sm:px-6">
        <p className="max-w-2xl">
          Sumber data:{" "}
          {sources.map((s, i) => (
            <span key={s.name}>
              {i > 0 && (i === sources.length - 1 ? " & " : ", ")}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-ink-line underline-offset-2 hover:text-fog"
              >
                {s.name}
              </a>
            </span>
          ))}
          . Di-sync &amp; di-aggregate otomatis dari tiap sumber. Kita aggregator
          — bukan verifier, bukan pemilik datanya. Tiap provider nampilin di-sync
          dari sumber mana aja.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-mute">
            <span className="font-medium text-fog">tokengratis.id</span> — karena
            raymond boros token.
          </p>
          <div className="[&_a]:p-1.5 [&_a]:-m-1.5">
            <SocialIcons />
          </div>
        </div>
      </div>
    </footer>
  );
}
