"use client";

/**
 * Pill toggle button — dipakai buat filter chip (modality directory, bahasa
 * opensource, kategori modal-gratis).
 *
 * State AKTIF sengaja GA ngandelin fill doang. Fill tonal paling gelap yang
 * masih kebaca "paper" cuma nyampe ~1.25:1 lawan chip putih — jauh dari 3:1
 * yang diminta WCAG 1.4.11 buat state kontrol UI. Mau lolos pakai fill doang
 * = chip-nya harus item, dan itu nabrak One Black Rule (hitam cuma buat
 * primary action, lagian 9 chip item = wallpaper). Jadi state dibawa
 * border-mute SOLID (4.85:1 lawan paper, 5.55:1 lawan chip putih) + glyph ✓;
 * bg-ink-sel cuma penguat, bukan penanda tunggal.
 *
 * ✓ aria-hidden — aria-pressed yang udah ngomong ke assistive tech.
 */
export default function Chip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** Angka opsional di ujung kanan — mis. "berapa hasil kalau chip ini diklik". */
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        // max-w-full = pagar. Tiap bug scroll horizontal yang pernah ship di
        // repo ini sumbernya anak flex yang ga bisa mengecil; ini bikin chip
        // ga akan pernah lebih lebar dari container-nya, sepanjang apa pun
        // label-nya.
        "inline-flex min-h-[44px] max-w-full shrink-0 items-center gap-1.5 rounded-[6px] border px-4 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/70",
        // font-weight sengaja ada di TIAP cabang, bukan di base — dua utility
        // font-weight barengan di satu class string menang-menangannya ikut
        // urutan stylesheet Tailwind, bukan urutan nulis.
        active
          ? "border-mute bg-ink-sel font-semibold text-fog active:bg-ink-line"
          : "border-ink-line bg-ink-soft font-medium text-mute hover:border-mute hover:text-fog active:bg-ink-line/60",
      ].join(" ")}
    >
      {active && (
        <span aria-hidden="true" className="text-[11px] leading-none">
          ✓
        </span>
      )}
      <span className="min-w-0">{children}</span>
      {count !== undefined && (
        <span
          className={[
            "shrink-0 text-[11px] font-normal tabular-nums",
            // mute di atas fill ink-sel cuma 3.99:1 — gagal AA buat teks kecil.
            // Pas aktif turunin dari fog (fog/70 = 5.67:1) biar tetep lebih
            // kalem dari label tapi tetep lolos.
            active ? "text-fog/70" : "text-mute",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </button>
  );
}
