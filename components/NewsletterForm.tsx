"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "ok" | "err";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `website` is the honeypot field — always empty for real users
        body: JSON.stringify({ email, website: "" }),
      });
      if (res.ok) {
        setStatus("ok");
        setEmail("");
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg(data?.error || "Gagal — coba lagi.");
        setStatus("err");
      }
    } catch {
      setMsg("Gagal — coba lagi.");
      setStatus("err");
    }
  }

  if (status === "ok") {
    return (
      <p className="rounded-[8px] border border-grass-line bg-grass-bg px-4 py-3 text-sm font-medium text-grass">
        📬 Sip, kedaftar! Bakal dikabarin tiap ada free API baru.
      </p>
    );
  }

  return (
    <div>
      <form
        onSubmit={submit}
        className="mx-auto flex w-full max-w-md flex-col gap-2 sm:flex-row"
      >
        {/* Honeypot field — hidden from real users, bots fill it automatically */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px" }}
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@kamu.com"
          aria-label="Alamat email buat langganan"
          className="flex-1 rounded-[8px] border border-ink-line bg-ink-soft px-4 py-3 text-sm text-fog placeholder:text-mute focus:border-fog/40 focus:outline-none focus:ring-2 focus:ring-fog/30 transition-colors"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-[8px] bg-ember px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-ember-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fog/40 disabled:opacity-60"
        >
          {status === "loading" ? "Mendaftarkan…" : "Daftar"}
        </button>
      </form>
      {status === "err" && (
        <p className="mt-2 text-xs text-ember">{msg}</p>
      )}
    </div>
  );
}
