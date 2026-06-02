import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getListItems } from "@/lib/data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "tokengratis.id — direktori API AI gratis";

// Font dibundel di repo (app/og-fonts/*.woff) → no build-time network fetch.
const FONT_DIR = join(process.cwd(), "app", "og-fonts");
const gelasio = readFileSync(join(FONT_DIR, "Gelasio-Medium.woff"));
const inter = readFileSync(join(FONT_DIR, "Inter-Regular.woff"));
const interSemiBold = readFileSync(join(FONT_DIR, "Inter-SemiBold.woff"));

// Palette (mirror app/globals.css)
const PAPER = "#f1f0e8";
const FOG = "#11181c";
const MUTE = "#5f6a70";
const LINE = "#e4e2d8";
const GRASS = "#0e793c";
const GRASS_BG = "#e8faf0";
const GRASS_LINE = "#a2e9c1";

export default function OpengraphImage() {
  const items = getListItems();
  const count = items.length;
  const totalModels = items.reduce((n, p) => n + p.modelCount, 0);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          fontFamily: "Inter",
        }}
      >
        {/* ── Floating navbar pill ── */}
        <div
          style={{
            margin: "36px 56px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
            border: `1px solid ${LINE}`,
            borderRadius: 999,
            padding: "16px 18px 16px 28px",
            boxShadow: "0 8px 30px rgba(17,24,28,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill={FOG}>
              <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41Z" />
            </svg>
            <div
              style={{
                display: "flex",
                fontFamily: "Gelasio",
                fontSize: 34,
                color: FOG,
              }}
            >
              tokengratis<span style={{ color: MUTE }}>.id</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <span
              style={{ fontSize: 20, fontWeight: 600, letterSpacing: 1, color: MUTE }}
            >
              ID
            </span>
            <div
              style={{
                display: "flex",
                background: "#000000",
                color: "#ffffff",
                borderRadius: 999,
                padding: "14px 26px",
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              Lihat direktori
            </div>
          </div>
        </div>

        {/* ── Hero ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 60px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              fontFamily: "Gelasio",
              fontSize: 96,
              fontWeight: 500,
              lineHeight: 1.04,
              letterSpacing: -2,
              color: FOG,
              textAlign: "center",
            }}
          >
            <span>API AI yang bisa</span>
            <span>dipake gratis</span>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              maxWidth: 800,
              marginTop: 30,
              fontSize: 27,
              lineHeight: 1.45,
              color: MUTE,
              textAlign: "center",
            }}
          >
            <span>Free tier &amp; free credits API LLM — di-aggregate otomatis dari sumber komunitas. Tiap provider nampilin </span>
            <span style={{ color: FOG, fontWeight: 600 }}>
              &nbsp;model, context window, rate limit &amp; modality&nbsp;
            </span>
            <span> apa adanya dari sumber.</span>
          </div>

          {/* ── Green pill (dinamis) ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 36,
              background: GRASS_BG,
              border: `1px solid ${GRASS_LINE}`,
              borderRadius: 999,
              padding: "12px 22px",
              fontSize: 26,
              fontWeight: 600,
              color: GRASS,
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#00a63e" />
              <path
                d="M7 12.5l3.2 3.2L17 8.5"
                stroke="#ffffff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {count} provider · {totalModels} model gratis
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Gelasio", data: gelasio, weight: 500, style: "normal" },
        { name: "Inter", data: inter, weight: 400, style: "normal" },
        { name: "Inter", data: interSemiBold, weight: 600, style: "normal" },
      ],
    },
  );
}
