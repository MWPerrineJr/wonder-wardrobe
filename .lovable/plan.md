Short answer: **yes** — once the app is published to the custom domain, `window.location.origin` becomes `https://thestandingchair.com` (or `www.thestandingchair.com`), so the owner dashboard share link will show that domain.

Right now it shows `lovableproject.com` because the preview runs inside the Lovable editor/previewer, and the component uses `window.location.origin` directly. That makes the copied link and QR code point at the preview host instead of the real public URL.

I can fix it so the share link always uses the live canonical domain, even while you're still in preview.

## Proposed plan

1. Define a single canonical site origin for shareable links (`https://thestandingchair.com` by default, with `www.thestandingchair.com` as an option).
2. Update `src/components/public-link-card.tsx` so the copied link, QR code, and "Open page" URL are built from the canonical origin, not `window.location.origin`.
3. Update `src/components/share-embed.tsx` to use the same canonical origin. It currently falls back to `https://thestandingchair.app`, which is the wrong TLD, and then flips to the preview origin after hydration.
4. Keep `window.location.origin` only as a fallback for local development.
5. Verify the QR code encodes the correct live URL and that the copied link opens the public shop page on the custom domain.

## Open question

Your project has both `https://thestandingchair.com` and `https://www.thestandingchair.com` configured. Which should be the primary canonical URL for shareable links and the QR code?

- A) `https://thestandingchair.com` (no www)
- B) `https://www.thestandingchair.com` (with www)
