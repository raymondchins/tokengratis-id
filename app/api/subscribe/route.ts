import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Newsletter subscribe — nambahin email ke Resend Audience.
 * Key di server (env RESEND_API_KEY) — ga pernah ke client.
 * Butuh env: RESEND_API_KEY + RESEND_AUDIENCE_ID (set di .env.local + Vercel).
 */
export async function POST(req: Request) {
  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Body ga valid" }, { status: 400 });
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
