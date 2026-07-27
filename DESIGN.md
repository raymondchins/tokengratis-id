---
name: tokengratis.id
description: Direktori free tier & free credits API LLM — paper-surface, editorial-serif, receipt-first.
colors:
  ink: "#f1f0e8"
  ink-soft: "#ffffff"
  ink-line: "#e4e2d8"
  ink-sel: "#dedbcb"
  fog: "#11181c"
  mute: "#5f6a70"
  ember: "#000000"
  ember-soft: "#1a1a1a"
  grass: "#0e793c"
  grass-bg: "#e8faf0"
  grass-line: "#a2e9c1"
  grass-solid: "#00a63e"
  grape: "#7c3aed"
  grape-bg: "#f4f3fb"
  grape-line: "#d8cef2"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', Times, serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Georgia, 'Times New Roman', Times, serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Georgia, 'Times New Roman', Times, serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.05em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
rounded:
  micro: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "64px"
  section-lg: "96px"
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.ember-soft}"
    textColor: "{colors.ink-soft}"
  button-secondary:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.fog}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.fog}"
  chip-filter:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.mute}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  chip-filter-active:
    backgroundColor: "{colors.ink-sel}"
    textColor: "{colors.fog}"
    rounded: "{rounded.md}"
  input-search:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.fog}"
    rounded: "{rounded.lg}"
    padding: "14px 16px 14px 44px"
    width: "100%"
  badge-free:
    backgroundColor: "{colors.grass-bg}"
    textColor: "{colors.grass}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-credit:
    backgroundColor: "{colors.grape-bg}"
    textColor: "{colors.grape}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  card-surface:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.fog}"
    rounded: "{rounded.lg}"
    padding: "20px"
  nav-pill:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.mute}"
    rounded: "{rounded.pill}"
    padding: "8px 12px 8px 20px"
  code-block:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.fog}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
---

# Design System: tokengratis.id

## 1. Overview

**Creative North Star: "The Field Notebook"**

This is the notebook of someone who actually went and checked. Warm paper stock (`#f1f0e8`),
Georgia set tight, ruled lines instead of drop shadows, and a marginal note under every single
entry telling you where it came from and when. The page never claims authority — it shows its
sources and lets you follow them. That is the whole aesthetic argument: a directory that earns
trust by exposing its own paper trail rather than by looking expensive.

Density is deliberately high. The audience is a developer on a phone, mid-task, comparing free
tiers — they want a page of rows, not a page of hero sections. So the system runs on one wide
content column (`max-w-5xl`, 1024px), 1px rules in `#e4e2d8` doing all the structural work, and
a single pure-black accent reserved for the one thing on screen you're supposed to click. There
are exactly two decorative gestures in the entire system: the floating navbar pill and the green
freshness dot. Everything else is information.

What this explicitly rejects: the word **"Verified"** anywhere on the surface, and the whole SaaS
landing-page grammar — gradient hero text, glassmorphism, big-number hero metrics, an uppercase
tracked eyebrow above every section, 01/02/03 section scaffolding. It also rejects fake
completeness: a field with no source data is removed from the DOM, never rendered as a hollow cell.
The serif is a bet that a directory can read like an editorial page and still be a tool.

**Key Characteristics:**
- Paper-warm neutral surface with pure-white cards floating on it — two-layer, never three
- Georgia serif for every heading; Inter for every piece of UI text, data, and label
- Flat by construction: 1px borders and surface swaps carry depth, not shadows
- Pure black (`#000000`) is the only action color, used on ~1 element per screen region
- Green means "free", purple means "credit" — semantic, never decorative
- Every datum carries a visible `Disinkron [tanggal] dari [sumber]` receipt
- 44px minimum touch target on every standalone control; inline prose links exempt
- Mobile and desktop are separate renders of the same row, not one layout squeezed

## 2. Colors

A warm paper ground, a cool near-black ink, and two semantic accents that only ever mean one
thing each. Restrained strategy: the accent budget for a given screen is roughly one primary
button plus whatever green the data actually earns.

### Primary
- **Ink Black** (`#000000`): The single action color. Primary buttons ("Lihat direktori", the
  per-row "Lihat" CTA), the selected state of snippet-target tabs, the current page in pagination,
  and `::selection`. Pure black on paper is the highest-contrast affordance available and it costs
  no hue — the palette stays quiet while the click target stays obvious. Hover deepens to
  **Ink Black Soft** (`#1a1a1a`), a barely-perceptible lift that confirms the pointer without
  flashing.

### Secondary
- **Grass Green** (`#0e793c`): Means *free*, and only that. Free-tier amounts in the directory
  ("Gratis: 1M token/hari"), the `free_tier` badge, "bisa buat indie Indonesia". Paired with
  **Grass Wash** (`#e8faf0`) as the badge fill and **Grass Line** (`#a2e9c1`) as its hairline.
  Text-on-wash measures 5.07:1. **Grass Solid** (`#00a63e`) is reserved for the 8–10px freshness
  dot — the one place the palette is allowed to be bright, because it is signalling liveness.

### Tertiary
- **Grape Violet** (`#7c3aed`): Means *credits* — a finite dollar amount, categorically different
  from a recurring free tier. Credit-value badges on `/modal-gratis`, secondary categorization.
  Paired with **Grape Wash** (`#f4f3fb`) and **Grape Line** (`#d8cef2`); text-on-wash is 5.17:1.
  Also appears as the `code` modality icon hue.

### Neutral
- **Paper** (`#f1f0e8`): The page ground. Warm, low-chroma, and load-bearing — it is what makes
  white cards read as *cards* without a single shadow. Also the recessed fill for code blocks,
  `.env` panes, small buttons, and category tags.
- **Card White** (`#ffffff`): Every raised surface — directory table, offer cards, panels, inputs,
  the navbar pill, the mobile menu.
- **Rule** (`#e4e2d8`): Every border, divider, table rule, and `divide-y`. This color does the job
  a shadow would do in another system.
- **Selected** (`#dedbcb`): The fill for a *chosen* multi-select control — currently only the
  filter chips. Deliberately not load-bearing: a tonal fill can never reach the 3:1 that WCAG
  1.4.11 demands for component state without turning into a black chip (you'd need relative
  luminance ≤0.30). State is carried by a solid Mute border plus a `✓`; this fill is the
  at-a-glance cue that lets you scan a row of chips without reading each border.
- **Fog Ink** (`#11181c`): Primary text. A cool near-black, deliberately not `#000` — black is
  spent on buttons, so body copy sits one notch back at 15.6:1 on paper.
- **Mute** (`#5f6a70`): Secondary text, labels, table headers, source lines, placeholders. Measures
  4.85:1 on paper and 5.55:1 on white — it clears AA as *body* text, which is why the source
  receipts can safely live in it at 11px.

### Modality Hues (functional, not palette)
Eight icon-only hues distinguish capability at a glance in a 3-column icon grid: slate `#475569`
(text), blue `#2563eb` (vision), green `#0d7a56` (image), amber `#b45309` (audio), rose `#e11d48`
(video), violet `#7c3aed` (code), cyan `#0891b2` (embeddings), pink `#db2777` (reranking). All are
pre-darkened to clear 3:1 as non-text graphics on white. These are a lookup table, not brand
colors — never borrow one for a button, background, or heading.

### Named Rules

**The One Black Rule.** `#000000` marks the primary action and nothing else. If a screen region
has two black elements competing, one of them is decoration and must be demoted to the outlined
secondary button. Black is never a background, never a heading color, never a border.

**The Semantic Accent Rule.** Green means free. Purple means credit. Neither color may be used
because a section "needed some color." A page with no free tiers on it shows no green, and that
is correct.

**The Two-Layer Rule.** Paper ground, white surface. That's the entire depth model. A white card
inside a white card is forbidden; recess with Paper (`#f1f0e8`) instead — which is exactly what
code blocks and `.env` panes do.

## 3. Typography

**Display Font:** Georgia (with `"Times New Roman", Times, serif`)
**Body Font:** Inter (with `ui-sans-serif, system-ui, sans-serif`), weights 400/500/600/700
**Mono Font:** the system mono stack (`ui-monospace, SFMono-Regular, Menlo, Consolas`)

**Character:** A true contrast pairing — an old-style serif with real thick/thin modulation against
a neutral grotesque. Georgia is the notebook's handwriting: it appears on headings and on the two
first-person asides, and nowhere else. Inter is the ruled data underneath it. The pairing works
precisely because the two fonts share nothing; a second sans would have been mush. Georgia is also
a free, universally-installed, zero-request font, which is the maintenance-free posture the whole
project runs on.

### Hierarchy
- **Display** (Georgia 500, 2.25rem → 3rem @640px → 3.75rem @768px, line-height 1.04,
  letter-spacing −0.02em): The page `h1` only. Breakpoint-stepped, never `clamp()` — this is a tool,
  and fluid type that resizes mid-scroll looks unstable in a data view. Ceiling is 3.75rem (60px),
  well under the shouting threshold.
- **Headline** (Georgia 600, 1.875rem, letter-spacing −0.02em): Section headings ("Cara kerja") and
  page titles on `/pilih`, `/fallback`, `/modal-gratis`.
- **Title** (Georgia 600, 1rem, letter-spacing −0.02em): Card and panel headings. Small enough that
  the serif reads as *voice* rather than as a competing display element.
- **Body** (Inter 400, 0.875rem, line-height 1.625): All prose, descriptions, table cells. The lede
  paragraph steps up to 1rem → 1.125rem @640px. Prose blocks cap at `max-w-2xl`/`max-w-xl` (~65ch);
  the directory table is allowed to run the full 1024px because dense tabular data reads fine wide.
- **Label** (Inter 600, 0.6875rem, letter-spacing 0.05em, UPPERCASE): Table column headers, panel
  headers, `dt` terms in the mobile model list. Uppercase is licensed **only** as a table/panel
  header — it is structural, not an eyebrow.
- **Mono** (system mono, 0.6875–0.75rem): Model IDs, code snippets, `.env` keys. Anything a user
  will copy into a terminal is mono; anything they'll read is not.

### Named Rules

**The Serif-Is-Voice Rule.** Georgia appears on `h1`–`h4` and on the two first-person asides on the
homepage ("Kenapa gw bikin ini…"). It is forbidden in buttons, labels, table cells, data, form
controls, and any UI chrome. The moment a serif shows up on a button, the page stops being a tool.

**The Uppercase Budget Rule.** Uppercase tracked text is permitted for table column headers, panel
headers, and definition-list terms. It is forbidden above a section heading. An uppercase kicker
over every section is the AI tell this project exists to avoid.

**The Copyable-Is-Mono Rule.** If the user is meant to select it and paste it somewhere, it renders
mono — model IDs, base URLs, env keys, snippets. No exceptions in either direction.

## 4. Elevation

This system is **flat by construction**. Depth is communicated by surface swap (Paper `#f1f0e8` →
Card White `#ffffff`) and by 1px `#e4e2d8` rules — the same way a ruled notebook page separates
entries. There is exactly **one** shadow token in the entire codebase, and it exists solely to lift
the navbar off content it scrolls over.

Recession is expressed the same way, inverted: code blocks, `.env` panes, small ghost buttons, and
category tags sit on Paper *inside* a white card, so they read as pressed into the surface. Grouped
cards use a `gap-px` grid over a `#e4e2d8` background — the "shadow" between the three "Cara kerja"
panels is literally a 1px rule showing through.

### Shadow Vocabulary
- **Floating chrome** (`box-shadow: 0 8px 30px rgba(17, 24, 28, 0.06)`): The sticky navbar pill and
  the mobile menu panel. Uses Fog Ink at 6% rather than neutral black, so the shadow is tinted to
  the same cool ink as the text and never reads gray-on-warm. This is the only shadow in the system.

### Named Rules

**The One-Shadow Rule.** `0 8px 30px rgba(17,24,28,0.06)` is used on floating chrome and nothing
else. A card, panel, badge, button, or dropdown that reaches for a shadow is wrong — give it a
`#e4e2d8` border or swap its surface instead. Audit test: if two elements on the same screen cast
shadows, one is decoration.

**The Hairline Rule.** All borders are exactly 1px `#e4e2d8`. A thicker or colored border is only
permitted where it is a semantic badge outline (`#a2e9c1` grass, `#d8cef2` grape) or the fill-matched
outline of an active black control. Colored side-stripes are forbidden outright.

## 5. Components

Everything interactive is at least 44px tall. Every interactive element uses the same focus
treatment: `focus-visible` only, `ring-2` in Fog Ink at 70% opacity — full-bleed row links use
`ring-inset` so the ring stays inside the table.

### Buttons
- **Shape:** Gently squared (6px radius) for standard actions; 4px for compact in-panel controls;
  fully round (`9999px`) for the navbar CTA and the "reset filter" escape hatch.
- **Primary:** Pure black fill (`#000000`), white text, 600 weight, `8px 16px` padding, 44px min
  height. Hover deepens to `#1a1a1a`. Reserved for one control per screen region — the directory
  rows deliberately do *not* use it (see the secondary treatment below and the One Black Rule).
- **Secondary / Ghost:** White fill, `#e4e2d8` border, Fog Ink text. Hover shifts the border to Mute
  (`#5f6a70`) — the border moves, not the fill. Active presses to `#e4e2d8` at 60%.
- **Recessed (in-panel):** Paper fill (`#f1f0e8`) on a white card, 4px radius, used for "Salin",
  pagination inside `ModelsTable`, and the model `<select>`.
- **Disabled:** 40% opacity + `cursor-not-allowed`. Never a color change.
- **Focus:** `ring-2 ring-fog/70`, `focus-visible` only. Native outline is always replaced, never
  merely removed.

### Chips
- **Style:** 6px radius, 44px min height, `16px` horizontal padding, 13px Inter 500. Unselected is
  white with a `#e4e2d8` border and Mute text; hover moves the border to Mute and the text to Fog.
- **State:** Selected is Selected fill (`#dedbcb`) + a **solid** Mute border (`#5f6a70`, no opacity
  modifier) + Fog Ink text at 600 + a leading `✓`. Tonal, not black, because filter chips are
  multi-select and several can be on at once. The border and the glyph are what satisfy WCAG 1.4.11
  (4.85:1 against paper, 5.55:1 against the white inactive chip); the fill alone is 1.44:1 and is a
  scanning aid, not the state carrier. `aria-pressed` carries the state for assistive tech.
- **Counts:** A chip may render a trailing count — the number of results you'd get by clicking it.
  Under this project's AND filter semantics that count *is* the explanation of the semantics, which
  is why there is no helper text. Count color is Mute when inactive, but `text-fog/70` when active
  (Mute over the Selected fill measures 3.99:1 and fails AA at that size).
- **Overflow:** The chip row **wraps at every breakpoint**. It must never scroll horizontally: a
  scrolling row hides facets and lets the reset control slide off-screen, and `overflow-x-auto`
  forces `overflow-y: auto`, which clips the focus ring. Extra rows on mobile are the accepted cost.

### Cards / Containers
- **Corner Style:** 8px for cards and panels. This is the largest radius in the system that isn't a pill.
- **Background:** Card White on Paper.
- **Shadow Strategy:** None. See Elevation.
- **Border:** 1px `#e4e2d8`, always.
- **Internal Padding:** `20px` (panels, offer cards) or `24px` (prose cards). Interactive cards
  shift their border to Mute on hover; they do not lift, scale, or shadow.
- **Grouped cards:** `grid gap-px` on a `#e4e2d8` background inside an `overflow-hidden` 8px
  container — dividers become the rules of the grid.

### Inputs / Fields
- **Style:** White fill, 1px `#e4e2d8`, 8px radius on the primary search field (4px on in-panel
  ones). The search field is 14px vertical padding with a 44px left inset for the icon.
- **Focus:** Border shifts to Fog at 40% *and* `ring-2 ring-fog/70`. Both, not either.
- **Placeholder:** Mute (`#5f6a70`) — chosen because it clears 4.5:1, not because it looked soft.
- **Select:** Native `<select>`, `min-h-[44px]`, styled to match the recessed button. Native form
  controls are kept native.

### Navigation
- **Style:** A sticky floating pill — `max-w-5xl`, fully rounded, white at **95%** with
  `backdrop-blur`, 1px `#e4e2d8`, and the system's one shadow. `top-3`, `z-50`. 95%, not 90%: at 90%
  the dense directory rows scrolling underneath stayed legible *through* the pill, slicing text
  mid-line. Translucency over a data list is a legibility cost, not a material.
- **CTA:** The `Lihat direktori` pill is black on every route except `/`, where it is demoted to the
  secondary treatment — on the homepage it only scrolls to a section already below the fold, and
  spending the region's single black on a near-no-op is exactly what the One Black Rule forbids.
- **Typography:** 14px Inter 500 in Mute; active and hover resolve to Fog Ink. `aria-current="page"`
  marks the active route.
- **Mobile:** Below `md` the center links collapse behind a 40px hamburger. The panel is
  **mounted and unmounted**, never toggled via visibility/max-height classes, and renders as a
  *sibling* of the pill rather than a child — the pill's `rounded-full` + `backdrop-blur` creates a
  stacking context that clips absolutely-positioned children. Closes on route change, outside
  pointerdown, and Escape (returning focus to the button).

### Directory Row (signature component)
Two separate renders of the same record — a mobile card and a `md:grid` row — never one layout
squeezed. The row is **not** a single wrapping anchor: it carries real source links (`SourceLine`,
plus the `Ga ada di sumber` receipt), and an `<a>` inside an `<a>` is invalid markup that browsers
silently un-nest. Navigation lives on two explicit links instead — the provider identity block
(logo + name + meta, `min-h-[44px]`) and the `Lihat` control — with `hover:bg-ink/40` and
`focus-within:bg-ink/40` keeping the whole row reactive. Any field with no source data is omitted
outright on mobile; on desktop the grid cell renders empty, never a dash.

### Source Line (signature component)
The component the whole project exists for. An 11px Mute line reading
`Disinkron 27 Jul 2026 dari mnfst/awesome-free-llm-apis`, where the source name is an underlined
external link with a `#e4e2d8` decoration that darkens to Fog on hover. When the upstream data
itself changed it appends `· sumber diperbarui [tanggal]` — two distinct signals, because a sync
timestamp is proof of liveness, not proof the data moved. It renders on every provider, every
model, every offer. It is never styled to be quiet enough to miss.

### Code Block (signature component)
Paper-recessed (`#f1f0e8`) inside a white card, 6px radius, 1px rule, 12px mono at 1.625 line-height,
`overflow-x-auto` with `pr-20` reserved for a floating "Salin" button pinned top-right. The copy
button reports all three states in a `role="status"` span: `Salin` → `Tersalin` (1.6s) →
`Gagal — salin manual` (4s) when the clipboard API is refused. A copy button that silently does
nothing is a broken affordance.

## 6. Do's and Don'ts

### Do:
- **Do** render the `SourceLine` receipt on every surface that displays synced data — `Disinkron
  [tanggal] dari [sumber]` with the source name as a live external link.
- **Do** give every standalone control `min-h-[44px]` and a `focus-visible:ring-2 ring-fog/70`.
  Links inline in running prose are exempt from the size rule (WCAG 2.5.8 exempts them, and padding
  a link mid-sentence wrecks line rhythm for zero conformance gain) — but link *lists* formatted as
  prose, like the footer's `Jelajah:` / `Alat:` rows, are not sentences and do get padded. The focus
  ring has no exemptions.
- **Do** carry selected-state contrast on a border and a glyph, not on a fill. A tonal fill cannot
  reach WCAG 1.4.11's 3:1 without becoming a black control; check the *border* against both
  adjacent surfaces instead.
- **Do** carry depth with a 1px `#e4e2d8` border or a surface swap. Reach for `#f1f0e8` to recess
  and `#ffffff` to raise.
- **Do** keep Georgia on `h1`–`h4` and Inter on everything a user operates.
- **Do** gate `min-w-[...]` behind a `md:` breakpoint whenever the row has its own mobile layout,
  and give grid items an explicit `min-w-0` — an unshrinkable child is the single cause of every
  horizontal-scroll bug this project has shipped.
- **Do** mount and unmount conditional UI. Never gate content visibility behind a class transition;
  transitions don't fire in background tabs or headless renders and the feature ships dead.
- **Do** pair every animation with a `prefers-reduced-motion: reduce` alternative, including
  Tailwind's `animate-pulse`, whose keyframes are unconditional.
- **Do** verify a responsive change by measuring the DOM at 375px. `tsc` and `next build` are
  structurally blind to layout.

### Don't:
- **Don't** use the word **"Verified"**, or any phrasing that claims this site checked something.
  The line is always "Synced [tanggal] dari [sumber]". This is the project's hard ban.
- **Don't** render **"Unknown"**, **"N/A"**, **"—"**, or a guessed boolean in place of a missing
  field. If a source doesn't provide the field in structured form, the field must not render at all.
  In a flow layout, omit the element entirely; in a grid or table where the track must stay aligned,
  render the cell **empty**. An empty cell reads "not provided"; an em dash reads "we checked, it's
  nothing." Where the absence is itself interesting — a free-tier amount the source never published
  — the strongest move is to replace the hole with the receipt: a quiet `Ga ada di sumber` linking
  to that provider's source.
- **Don't** import SaaS landing-page grammar: no gradient hero text, no glassmorphism, no
  big-number hero metrics, no uppercase tracked eyebrow above every section, no 01/02/03 scaffolding.
- **Don't** add a `box-shadow` to a card, badge, button, or panel. The system has one shadow and it
  belongs to floating chrome.
- **Don't** use `border-left` or `border-right` above 1px as a colored accent stripe. The "Jebakan"
  callout on `/modal-gratis` shows the correct pattern: recessed background + border + icon + label.
- **Don't** spend green or purple on decoration. Green is free-tier, purple is credits; a section
  that needs "some color" doesn't get any.
- **Don't** put a second black element in a screen region. One primary action, one black.
- **Don't** introduce a display font, a second sans, or a new hue without deleting something first.
  The palette is 14 tokens and the type system is 2 families, on purpose.
- **Don't** build for a community that doesn't exist: no voting, comments, submission forms, user
  accounts, or admin panels.
- **Don't** use `clamp()` for headings. This is a tool; the type scale steps at breakpoints.
