import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "tokengratis.id — Direktori API AI gratis",
    short_name: "tokengratis",
    description:
      "Kumpulan free tier & free credits API LLM, di-aggregate otomatis dari sumber komunitas. Aggregator transparan, bukan verifier.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f0e8",
    theme_color: "#f1f0e8",
  };
}
