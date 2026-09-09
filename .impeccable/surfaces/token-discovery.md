# Token discovery

Recorded from source on 2026-09-09. Direction: Operate — a task-first light paper utility catalog. No visual verification performed.

- **Thesis:** Make provider discovery and the next step readable without requiring API vocabulary first.
- **World:** The Field Notebook: light paper, white panels, Georgia editorial titles/wordmark, Inter controls, dark actions, sourced green free-information text.
- **Story:** Search a model/provider or choose a need → compare provider information → open Cara pakai → follow the official provider link and setup guidance.
- **First viewport:** Compact editorial title and explanation, explicit search, visible plain-language need chips, then results. Advanced combinations are disclosed in normal flow. Exact viewport fit has not been inspected.
- **Form:** Six provider results per directory page, single column then two columns from 768px. Modality landing pages reuse ProviderCard but list their matching providers without directory pagination. Information is inside cards; action links are below. Missing structured fields are omitted and existing source descriptions remain prose.
- **Detail:** Official starting action and sourced limits lead. Model limits follow. Setup code and technical information use native disclosures. Sources remain visible in a sidebar that moves below the main content at narrower widths.
- **Secondary paths:** Shared navigation exposes Cari token, Cara pakai, and Lainnya. The footer keeps primary sources visible and secondary resources in a disclosure. Existing /pilih, /fallback, /modal-gratis, /opensource, /changelog, and related legacy tool layouts are not represented as redesigned by this record.

Evidence: app/page.tsx; app/directory/DirectoryClient.tsx; lib/constants.ts; components/directory/ProviderCard.tsx; app/provider/[slug]/page.tsx; app/gratis/[modality]/page.tsx; components/Navbar.tsx; components/Footer.tsx; app/globals.css.

Scope note: the source uses a Georgia wordmark, confirmed during documentation. Small source receipts and glyph-based action icons are not promoted into new component tokens. The synthesized tonal strips in design.json are panel previews, not a new source palette.
