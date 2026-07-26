"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary buat error yang kejadian di root layout itu sendiri.
 * Wajib render <html>/<body> sendiri karena layout-nya udah ga kepakai.
 * Style-nya inline — globals.css belum tentu ke-load di jalur ini.
 */
export default function GlobalError({
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
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f1f0e8",
          color: "#11181c",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "#5f6a70",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            Error
          </p>
          <h1
            style={{
              margin: "12px 0 0",
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
              fontSize: "32px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Situsnya lagi bermasalah
          </h1>
          <p
            style={{
              margin: "20px 0 0",
              fontSize: "16px",
              lineHeight: 1.6,
              color: "#5f6a70",
            }}
          >
            Ada yang rusak di level paling atas. Coba muat ulang halamannya.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "32px",
              minHeight: "44px",
              padding: "12px 24px",
              borderRadius: "9999px",
              border: "none",
              background: "#000000",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
