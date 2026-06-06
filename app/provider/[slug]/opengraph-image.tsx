import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getProviderBySlug } from "@/lib/data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Provider API gratis — tokengratis.id";

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

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const provider = getProviderBySlug(slug);

  const fonts = [
    { name: "Gelasio", data: gelasio, weight: 500 as const, style: "normal" as const },
    { name: "Inter", data: inter, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: interSemiBold, weight: 600 as const, style: "normal" as const },
  ];

  // Fallback kalau slug ga ketemu
  if (!provider) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: PAPER,
            fontFamily: "Inter",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Gelasio",
              fontSize: 64,
              color: FOG,
              letterSpacing: -1,
            }}
          >
            tokengratis<span style={{ color: MUTE }}>.id</span>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTE, marginTop: 16 }}>
            Direktori API AI gratis
          </div>
        </div>
      ),
      { ...size, fonts },
    );
  }

  const modelLine = `${provider.modelCount} model gratis`;
  // maxContext is already a display string (e.g. "10M", "131K", "1M") — render as-is.
  const contextLine = provider.maxContext
    ? `${provider.maxContext} context`
    : null;

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
            <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: 1, color: MUTE }}>
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
          {/* Provider name */}
          <div
            style={{
              display: "flex",
              fontFamily: "Gelasio",
              fontSize: provider.name.length > 20 ? 72 : 96,
              fontWeight: 500,
              lineHeight: 1.04,
              letterSpacing: -2,
              color: FOG,
              textAlign: "center",
            }}
          >
            {provider.name}
          </div>

          {/* Model count + context */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginTop: 22,
              fontSize: 28,
              color: MUTE,
            }}
          >
            <span>{modelLine}</span>
            {contextLine && (
              <>
                <span style={{ color: LINE }}>·</span>
                <span>{contextLine}</span>
              </>
            )}
          </div>

          {/* Green "Gratis" pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 32,
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
            Gratis
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
