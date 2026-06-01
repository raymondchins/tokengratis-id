import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// --- Best-effort in-memory rate limiter ---
// NOTE: serverless instances are NOT shared — each lambda instance has its own Map.
// This throttles repeated hits on a single warm instance; it does NOT protect against
// distributed bot traffic across cold-start instances. The honeypot is the primary defense.
const RATE_WINDOW_MS = 60_000; // 60 seconds
const RATE_MAX = 5; // max requests per IP per window
const ipTimestamps = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const timestamps = (ipTimestamps.get(ip) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= RATE_MAX) {
    // Prune and store without recording this attempt
    ipTimestamps.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  ipTimestamps.set(ip, timestamps);
  return false;
}

/**
 * Newsletter subscribe — nambahin email ke Resend Audience.
 * Key di server (env RESEND_API_KEY) — ga pernah ke client.
 * Butuh env: RESEND_API_KEY + RESEND_AUDIENCE_ID (set di .env.local + Vercel).
 */
export async function POST(req: Request) {
  // --- Rate limit check ---
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429 },
    );
  }

  let email = "";
  let honeypot = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
    // `website` is the honeypot field — real users never fill it.
    honeypot = String(body?.website ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body ga valid" }, { status: 400 });
  }

  // --- Honeypot check: silently pretend success so bots don't learn they're blocked ---
  if (honeypot) {
    return NextResponse.json({ ok: true });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Email ga valid" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    return NextResponse.json(
      { error: "Newsletter belum dikonfigurasi" },
      { status: 503 },
    );
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.contacts.create({
      email,
      audienceId,
      unsubscribed: false,
    });
    if (error) {
      return NextResponse.json({ error: "Gagal mendaftarkan" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Gagal mendaftarkan" }, { status: 500 });
  }
}
