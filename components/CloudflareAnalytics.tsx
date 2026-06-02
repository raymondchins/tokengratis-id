import Script from "next/script";

// Cloudflare Web Analytics — beacon publik (token aman tampil di client, bukan secret).
// Ambil token: dash.cloudflare.com → Web Analytics → Add a site → tokengratis.id → copy "token".
// Kosong = komponen ga render apa-apa (aman buat push sebelum token ada).
const CF_BEACON_TOKEN = "d05392b55d5d4123b51822bc37abbcc7";

export default function CloudflareAnalytics() {
  if (!CF_BEACON_TOKEN) return null;
  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={`{"token": "${CF_BEACON_TOKEN}"}`}
    />
  );
}
