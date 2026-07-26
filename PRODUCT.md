# Product

> Derived from `CLAUDE.md`, `docs/PRD.md`, and the codebase on 2026-07-26. Not an interview —
> every field below was already recorded in repo docs. Correct anything that drifted.

## Register

product

Rationale: the dominant surfaces are task surfaces — the filterable directory, the `/pilih`
model wizard, the `/fallback` chain generator, and `/provider/[slug]` with copy-paste setup
snippets. Design SERVES the job. The homepage hero is the one brand-register moment sitting on
top of a product surface; treat it as such when working on it specifically.

## Users

Indonesian developers — heavily students, bootcamp grads, indie hackers, and early-career devs
who "kepentok token" (hit paid-API limits) and need a free-tier LLM API they can use *today*.
Context: mobile-heavy, often on a phone, low patience, evaluating quickly. The job to be done is
narrow and concrete: **find a provider that's actually free for my use case, and get working code
into my project.** Secondary job: keep a project alive when one provider rate-limits (`/fallback`).

## Product Purpose

An auto-aggregated directory of free-tier and free-credit LLM APIs, synced nightly from four
community sources. It exists because that information is scattered, stale, and English-first.
Success = always fresh, always honest, ~zero maintenance. Explicitly **not** a startup and **not
monetized** — it's a social/branding project. No DB, no auth, no accounts, no submissions.

## Brand Personality

Honest, casual, technical. Voice is Indonesian first with English technical terms left intact
("free tier", "context window", "rate limit") — how the audience actually talks. Slightly blunt
and self-aware ("daripada ngarang", "Catatan jujur:"). Emotional goal: **trust through
receipts, not claims.** The site should feel like a knowledgeable friend showing you their notes
and telling you where they got them, not a vendor pitching you.

## Anti-references

- **Anything that says "Verified".** Hard ban. The site is an aggregator, not a verifier.
  Always "Synced [tanggal] dari [sumber]" with a link.
- **SaaS landing-page grammar**: gradient hero text, glassmorphism, big-number hero metrics,
  an uppercase tracked eyebrow above every section, 01/02/03 section scaffolding.
- **Fake completeness**: any table cell reading "Unknown", "N/A", "—", or a guessed boolean.
  If a source doesn't provide a field in structured form, the field must not render at all.
- **Feature bloat that waits on a community that doesn't exist yet**: voting, comments,
  submission forms, user accounts, admin panels.

## Design Principles

1. **Show the receipt, not the claim.** Every datum renders its source, sync date, and link.
   Trust comes from transparency; it is never asserted.
2. **Absent beats invented.** A missing field is removed from the UI, never filled with a
   placeholder, a dash, or an inference. Better to show less that's real.
3. **Mobile is the primary viewport.** The audience is on a phone. A layout that only works at
   1280px is a broken layout, not a desktop-first one.
4. **The task is the page.** Get the user from "which provider?" to "code in my editor" with the
   fewest steps. Density is fine; ceremony is not.
5. **Maintenance-free by construction.** Static output, no runtime state, no backend to rot.
   Anything that requires Ray to remember to do something weekly is a design failure.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Site language is `lang="id"`. Known commitments already in place: skip-to-
content link, labeled inputs, alt text on all images, no `outline:none` without a replacement
ring, and a `prefers-reduced-motion` block gating the view-transition crossfade. Open gaps as of
this audit: touch targets below 44px on several controls, missing `aria-pressed` on filter chips,
missing `aria-current` on nav, missing `aria-live` on filter result counts, and `animate-pulse`
not covered by the reduced-motion query.
