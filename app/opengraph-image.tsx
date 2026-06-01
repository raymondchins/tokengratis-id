import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "tokengratis.id — direktori API AI gratis";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#f1f0e8",
          color: "#11181c",
        }}
      >
        <div style={{ fontSize: 30, color: "#5f6a70" }}>tokengratis.id</div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            marginTop: 20,
            maxWidth: 980,
            lineHeight: 1.05,
          }}
        >
          API AI yang bisa dipake gratis
        </div>
        <div style={{ fontSize: 28, color: "#5f6a70", marginTop: 28 }}>
          Free tier &amp; free credits API LLM · di-aggregate dari sumber komunitas
        </div>
      </div>
    ),
    size,
  );
}
