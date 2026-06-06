import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#11181c",
          color: "#f1f0e8",
          fontSize: 124,
          fontWeight: 700,
          borderRadius: 40,
        }}
      >
        t
      </div>
    ),
    size,
  );
}
