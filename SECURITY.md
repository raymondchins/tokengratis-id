# Security Policy

## Scope

tokengratis.id is a **static site** — no database, no auth, no user accounts, and it stores **no user data**. The only server surface is a dormant newsletter route (`app/api/subscribe`) that is not mounted in the UI. Attack surface is intentionally minimal.

## Reporting a vulnerability

If you find a security issue, please **do not open a public issue**. Email **raymondchin.s@gmail.com** with:

- a description of the issue and where it is,
- steps to reproduce (or a proof of concept), and
- the potential impact.

You'll get an acknowledgement as soon as possible. Since this is a non-commercial community project maintained by one person, there's no bug-bounty — just genuine thanks and credit if you'd like it.

## Out of scope

- The hardcoded Cloudflare Web Analytics beacon token in `components/CloudflareAnalytics.tsx` is **public by design** (it ships in the page HTML on every visit) — it cannot read or write the analytics account. Not a vulnerability.
- Aggregated data accuracy issues → use the "Data correction" issue template, not this policy.
