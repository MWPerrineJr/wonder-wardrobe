# Per-shop public pages

Each business gets its own shareable page at `thestandingchair.app/shop/<their-slug>` — for example `/shop/mikes-dudes` — that they can hand to clients directly.

## What changes

**New public shop page**

- The booking page moves from `/shop?slug=mikes-dudes` to a clean `/shop/mikes-dudes` URL.
- The page content stays exactly as it is today (hero, services, barbers, map, booking panel, feedback form).
- Each shop page gets its own page title, description, and social-share preview built from that shop's name, description, and cover image — so a link pasted into a text message or Instagram bio shows the shop's own branding.
- Unknown slugs show a friendly "shop not found" page with a link back to browsing.

**`/shop` with no slug**

- Becomes a simple "browse shops" landing that lists all shops and links into each shop page, instead of the current empty state.

**Owner dashboard**

- New "Your public link" card showing the full URL.
- **Copy link** button (copies to clipboard, confirms with a toast).
- **QR code** for the link, rendered on the page with a **Download PNG** button for printing on window decals or cards.
- Existing "View public page" link points at the new URL.

**Existing links updated**

- Marketplace shop cards, owner dashboard, and any other internal links move to the new URL shape.
- Old `/shop?slug=x` links keep working via a redirect to `/shop/x`, so anything already shared stays valid.

## Technical notes

- New route file `src/routes/shop.$slug.tsx` (`createFileRoute("/shop/$slug")`) holding the current `ShopPage` content, reading `Route.useParams()` instead of search params; loader prefetches `getPublicShopBySlug` and `getBookingContext` via `ensureQueryData`, and `head({ loaderData })` emits per-shop title/description/`og:*`/`twitter:*` (og:image only when the shop has an absolute https cover URL).
- `src/routes/shop.tsx` becomes a layout rendering `<Outlet />`; `src/routes/shop.index.tsx` is the browse-all leaf and redirects `?slug=` to `/shop/$slug` in `beforeLoad`.
- Loader throws `notFound()` when the slug has no shop; route declares `errorComponent` and `notFoundComponent`.
- QR code generated client-side with the `qrcode` package into a canvas (no server call, no external image service); download uses `canvas.toDataURL`.
- Public URL built from `window.location.origin` on the client so it is correct in preview, published, and custom-domain contexts.
- No database or RLS changes needed — slugs already exist and are unique on `shops`, and public shop reads are already allowed.
