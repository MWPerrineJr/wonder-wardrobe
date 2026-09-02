# Rename to The Standing Chair + clean modern redesign

## What changes

**1. Rename everywhere**
Every visible mention of "Crown & Cut" becomes "The Standing Chair": logo/wordmark in the marketplace header, booking page, barber calendar, owner dashboard, feedback dashboard, account page, auth pages, welcome overlay, sign-out dialog, and the agent-integration consent screen. Page titles, descriptions, and social preview text get rewritten per page with the new brand.

Internals also rename (as chosen): the agent-integration server name/title and tool descriptions, and the guest-mode browser key (`cnc_guest` -> `tsc_guest`, meaning the welcome overlay shows once more per visitor). No database tables, columns, or existing rows are touched.

**2. Clean modern look**

- Palette: Warm Stone — page background #FAF8F5, ink #1C1917, muted amber accent #8A7A5C, soft borders/surfaces #E7E2D9. The old dark-gold (#735c00 / #D4AF37) accents are replaced everywhere with the new accent so nothing hardcoded is left behind.
- Typography: Outfit for headings, Figtree for body, loaded in the app shell (replacing Montserrat/Inter).
- Layout: split-screen homepage — left column carries the headline, subhead, and search; right column carries a large shop/brand visual. Below it, shop results stay in a clean card grid.
- Overall styling pass for a calmer modern feel: larger radii, thinner 1px borders instead of heavy shadows, more whitespace, restrained hover states, and consistent card/button treatments across shop, barber, owner, feedback, account, and auth screens.

Functionality stays exactly as it is — booking, feedback, owner management, auth, maps and agent tools all keep working the same.

## Technical notes

- `src/styles.css`: swap the `@theme` color tokens to the Warm Stone values and repoint the `--font-*` tokens to Outfit/Figtree. Keep the existing token names so components need no rename, and adjust `.glass-panel` / calendar-grid helpers to the lighter palette.
- `src/routes/__root.tsx`: replace the Google Fonts link with Outfit + Figtree (keep Material Symbols), update root metadata.
- Each route file gets its own `head()` with a unique The Standing Chair title/description plus og/twitter tags.
- `src/routes/index.tsx`: restructure the hero into a two-column split (stacks on mobile), keep the existing fuzzy search logic untouched.
- Sweep remaining hardcoded gold/`#D4AF37`/`text-classic-gold`-style utilities in route and component files over to semantic tokens.
- `src/lib/mcp/index.ts`, `src/lib/mcp/tools/*`, and the consent route: rename server name/title/instructions, then regenerate `.lovable/mcp/manifest.json` with the extractor.
