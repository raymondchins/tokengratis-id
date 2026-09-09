---
name: tokengratis.id
description: A light paper utility catalog with editorial titles, direct controls, and visible sources.
colors:
  ink: "#f7f7f2"
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
  headline:
    fontFamily: "Georgia, 'Times New Roman', Times, serif"
    fontSize: "1.875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    lineHeight: 1.428571
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    lineHeight: 1.625
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  pill: "9999px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  card: "20px"
  xl: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.xl}"
    padding: "12px 20px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.ember-soft}"
  button-secondary:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.fog}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  chip-filter:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.fog}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  chip-filter-active:
    backgroundColor: "{colors.fog}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
  input-search:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.fog}"
    rounded: "{rounded.2xl}"
    padding: "8px 8px 8px 16px"
  card-surface:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.fog}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  navigation:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.mute}"
    padding: "8px 16px"
---

# Design System: tokengratis.id

## Overview

**Creative North Star: "The Field Notebook"**

The established Field Notebook identity now serves a light paper utility catalog. Georgia gives page titles and the wordmark a familiar editorial voice; Inter carries controls, provider names, and working section headings. White panels, quiet rules, and visible source links keep the interface practical and candid.

This record merges the incumbent identity with source inspected on 2026-09-09. It covers the homepage directory, provider detail, modality listings, and shared navigation/footer. Secondary tools retain their existing layouts and smaller component variants. No browser, screenshot, computed-style, or visual verification was performed; historical accessibility measurements in PRODUCT.md are not fresh validation of this build.

**Key Characteristics:**
- Light paper ground and white information surfaces.
- Editorial page titles; plain sans-serif working hierarchy.
- Dark controls and selected states; green free-information text.
- Visible source attribution and progressively disclosed secondary detail.

## Colors

The palette remains low-chroma paper and cool dark ink; the lightened paper value in frontmatter is the current CSS value, superseding the old value in AGENTS.md and stylesheet comments.

### Primary
- **Ember / Ember Soft:** Black action fill and its hover state. The name is inherited; orange is not active.
- **Fog:** Primary text, dark selected need chips, input focus, and native checkbox accent.

### Secondary
- **Grass:** Free-tier information in provider cards and detail. Green washes, outlines, and status dots remain in secondary offer/open-source/status surfaces.

### Tertiary
- **Grape family:** Retained for existing offer-credit and open-source categorization. It is not a modality palette for the refreshed discovery cards.

### Neutral
- **Ink / Ink Soft:** Paper page ground and white card, field, and navigation surfaces.
- **Ink Line:** Fine separators and inactive control borders.
- **Ink Sel:** Tonal hover fill for provider action links; legacy selection treatments also remain.
- **Mute:** Supporting prose, source receipts, placeholders, and inactive navigation.

**The Semantic Accent Rule.** Use green for free-information emphasis in the discovery flow. Keep action and selected controls in the dark neutral palette; legacy tools retain their existing semantic green and purple treatments.

## Typography

**Display Font:** Georgia, with Times fallbacks; this is the explicitly retained incumbent brand face.
**Body Font:** Inter, with sans-serif fallbacks. Existing code and model identifiers retain system monospace.

The refreshed hierarchy steps from 30–48px editorial titles into 18–24px sans-serif working headings, then 14–16px body text and 12px supporting copy. The homepage title uses 36px then 48px at the small breakpoint, with 1.12 line-height; that composition belongs to its surface brief. Provider titles step from 30px to 36px. Provider card names use 18px/600 and 1.375 line-height. Recurring detail section titles use the title token; the results heading grows to 24px at the small breakpoint. Body descriptions use the body token; form and navigation labels use normal case, with weight selected by function.

Global headings default to Georgia with −0.02em tracking; explicit tight-tracking utilities use −0.025em. Explicit sans-serif headings override the global family. SourceLine still uses 11px text; it is recorded below as a limitation, not as a recommended caption token.

**The Working Type Rule.** Use Inter for controls, provider names, and operational section headings. Keep Georgia for editorial page titles and the established wordmark.

## Layout

Refreshed pages share a centered 1152px maximum container. Main content uses 20px horizontal gutters, increasing to 32px at 640px; navigation and footer use 16px then 24px. Provider cards stack at narrow widths and form two columns from 768px, with 24px horizontal gaps. Repeated panel padding steps from 20px to 24px at 640px. Spacing is predominantly in 4px increments; 8/12/16/20/24/32px form the reusable rhythm.

Provider detail becomes a flexible main column plus a 320px sidebar at 1024px, with a 40px gap and a sticky sidebar 96px from the top. At smaller widths it remains in document flow. Secondary tools retain narrower containers and their pre-existing layouts. Discovery sequence and result count are documented in `.impeccable/surfaces/token-discovery.md`, not imposed on every page.

## Elevation & Depth

The refreshed flow is flat: white surfaces on paper, thin borders, and occasional paper recesses. The old floating-pill navbar shadow and translucent blur are absent from the current Navbar; neither remains a token. Focus is an interaction signal rather than decorative elevation: the global rule provides a 2px Fog outline with 3px offset. Some established controls use a 2px Fog-at-70% ring instead; the search group uses a 2px focus-within ring.

**The Ruled Surface Rule.** Separate content with a surface change or a thin border. The refreshed navigation, cards, and panels carry no decorative shadow.

Navigation crossfades use 200ms ease only when reduced motion is not requested. Reduced-motion CSS removes those animations and pulsing status animation. Standard control transitions change colors; the build does not establish a general entrance-animation system.

## Shapes

Soft rectangular panels use the 16px radius, action buttons and disclosure panels use 12px, and secondary links/selects use 8px. Need chips are fully rounded. Existing pagination retains 6px corners; legacy badge and code variants retain their smaller radii. This is a family of functional shapes, not a universal pill rule. Ordinary borders are 1px; the search border is Mute for stronger field definition.

## Components

### Buttons

Primary actions use black fill, white 14px semibold type, 12px corners, and at least 48px height. Provider-start actions use 12px vertical and 20px horizontal padding; the search action uses the same horizontal inset. Hover uses Ember Soft. Pagination's secondary buttons remain white with a thin rule, 6px corners, 8px/12px padding, and at least 44px height; hover darkens the border, press adds a tonal fill, and disabled controls have 40% opacity.

### Chips

Quick-need controls wrap and have at least 44px height, pill corners, 8px/16px padding, normal-case 14px labels, and `aria-pressed`. Inactive chips are white with a thin rule; hover darkens the border. Selected chips use Fog fill, matching border, and white text. Advanced combined needs use labeled native checkboxes rather than this single-need selection pattern.

### Cards / Containers

ProviderCard and the provider-start panel share white fill, a thin rule, 16px corners, and responsive 20px/24px padding. Cards use Inter names, green sourced free information, readable modality text, and source links. Descriptions wrap without a line clamp. Provider navigation actions sit beneath the information panel; they are separate links with at least 44px height and a tonal hover background. The whole panel is not a wrapping anchor.

### Inputs / Fields

The discovery search is a white 16px-radius group with a Mute border and internal search icon, input, and submit action. Its input is at least 48px tall, 16px type, and transparent inside the group. Group focus stays visible even though the input removes its own outline. Sorting uses a native select with at least 44px height, white fill, thin rule, and 8px corners.

### Navigation

Navbar is a full-width sticky white header at top zero with a bottom rule. Its centered content wraps the link row below the brand on small screens, then uses one row from 640px. The wordmark is Georgia 20px/500; navigation links are Inter 14px/500. Dark text marks active and open states. The Lainnya disclosure is a right-aligned white bordered panel, 224px wide, with 12px corners. It closes on outside pointer, route change, focus departure, or Escape; Escape returns focus to its trigger. The footer uses a native disclosure for secondary links and data resources.

### Source receipts and disclosures

SourceLine presents sync date and linked source names; source-update time is separate when available. Provider cards show the first source plus a link to additional sources. Provider detail keeps attribution visible in the sidebar while setup code and technical metadata use native details/summary. Existing source and code components are retained rather than redesigned.

## Do's and Don'ts

### Do:
- Do keep source names as usable links beside sync information.
- Do give standalone controls at least 44px height and a visible keyboard focus treatment.
- Do let cards and controls wrap, with shrinkable content columns and wrapping long descriptions.
- Do retain reduced-motion handling for navigation transitions and pulsing status indicators.

### Don't:
- Don't claim independent verification of aggregated data.
- Don't invent missing provider fields or fill their place with guessed values.
- Don't introduce decorative kickers, gradient headline text, or glass surfaces.
- Don't treat the legacy secondary tools as evidence that the refreshed discovery flow still uses a dense provider table.

**Not canonized:** 11px source receipts, Unicode arrow/plus/minus action icons, and the green hover on the homepage helper link remain source-level limitations: small attribution needs visual legibility review, glyph icons are not reusable icon assets, and that green hover does not establish a second action palette. Historical contrast/accessibility claims and obsolete hidden-filter/table/navbar prescriptions were not carried forward as current guarantees.
