# Add "built by pandagentic.ai" branding under the site logo

Add a small Pandagentic byline beneath "The Standing Chair" in every public-facing top-left brand mark, and make the byline a hyperlink to pandagentic.ai.

## 1. Shared brand component

Create `src/components/site-brand.tsx`:

- Renders the main brand text "The Standing Chair" linking back to `/`.
- Renders a second line below it: "built by pandagentic.ai".
- The second line links to `https://pandagentic.ai`, opens in a new tab, and uses `rel="noopener noreferrer"`.
- Uses existing tokens: primary text for the brand name, muted/on-surface-variant text for the byline, primary hover state for the link.

## 2. Apply to public routes

Replace the standalone "The Standing Chair" `<Link>` in the top-left corner of each public route with the new `SiteBrand` component:

- `src/routes/index.tsx` (marketplace desktop header)
- `src/routes/shop.index.tsx` (browse shops header)
- `src/routes/shop.$slug.tsx` (individual shop page header)
- `src/routes/demo.index.tsx` (demo page header)

Authenticated routes such as `/owner` are out of scope because the user requested public pages only.

## 3. Verify

Run typecheck to confirm imports and JSX are valid.
