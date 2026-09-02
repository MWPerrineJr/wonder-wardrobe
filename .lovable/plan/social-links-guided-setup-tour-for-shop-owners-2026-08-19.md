# Social links + guided setup tour for shop owners

Two additions for shop owners: social media / contact links on their public page, and a step-by-step guided tour that walks them through setting up that page.

## 1. Social + contact links

Today there is no way for an owner to add social links (only `google_review_url` exists).

**New "Links" tab on the owner dashboard**

- Fields for Instagram, Facebook, TikTok, X (Twitter), YouTube — each accepts a full URL or a handle (`@mikesdudes`), normalized to a proper profile URL on save.
- Website, phone, and WhatsApp fields for direct contact.
- Up to 5 free-form links (custom label + URL) for anything else — Linktree, menus, gift cards.
- Live preview of the icon row as it will appear on the public page, drag-free reordering not included.
- Saved with the same awaited-write pattern as the rest of the dashboard: validate, save, confirm from the database, then toast.

**On the public shop page (`/shop/<slug>`)**

- Icon row under the shop hero: recognizable icon per platform, label-based buttons for custom links, tap-to-call and WhatsApp chat links on mobile.
- Only links the owner filled in are shown; empty state shows nothing (no broken icons).
- Links open in a new tab with `rel="noreferrer"`; phone/WhatsApp use `tel:` / `wa.me`.
- Social profiles are added to the page's JSON-LD `sameAs` so search engines connect the shop to its accounts.

**Validation rules**

- URLs must be `https://` (or `http://` rejected), max 300 characters, host-checked per platform so an Instagram field can't hold a random link.
- Phone limited to digits and `+ ( ) - .`; WhatsApp normalized to digits for `wa.me`.
- Custom link labels max 30 characters, plain text only.

## 2. Guided step-by-step setup tour

A highlighted walkthrough overlay on the owner dashboard, aimed at a brand-new owner.

- Starts automatically the first time an owner lands on the dashboard, with a "Set up your page" intro card (Start tour / Maybe later).
- Steps, each spotlighting the real dashboard element with a tooltip explaining what to do and why it matters:
  1. Shop details — name, description, address, cover photo
  2. Categories — what kind of services you offer
  3. Services — add your menu with durations and prices
  4. Hours — set your weekly schedule
  5. Payments — connect payouts and choose deposit or full prepay
  6. Links — add your social and contact links
  7. Your public link — copy it, download the QR code, share it
  8. Analytics & feedback — what the paid plan adds
- Tour navigates the dashboard tabs as it advances, so each step shows the actual form being described.
- Controls: Back, Next, Skip tour, step counter, Escape or click-outside to exit, keyboard arrows.
- Progress is remembered, so re-entering resumes where they left off; completion is remembered so it does not reappear.
- A persistent "Take the tour" button in the dashboard header lets owners replay it any time.
- Each step also shows a small live status ("3 services added", "Hours not set yet") so owners can see what is still missing.

## Technical notes

- Migration adds nullable social/contact columns to `public.shops` (`instagram_url`, `facebook_url`, `tiktok_url`, `x_url`, `youtube_url`, `website_url`, `phone`, `whatsapp`) plus `social_links jsonb not null default '[]'` for the free-form entries. Existing `shops` RLS and grants already cover owner writes and public reads, so no policy changes; a `shops`-level check constraint keeps `social_links` an array with at most 5 objects.
- `UpdateShopInput` in `src/lib/owner.functions.ts` gains a Zod schema for the new fields (URL + host validation, handle-to-URL normalization done server-side before the update), and `updateShop` returns the new columns via `.select()`.
- Public read path: add the new columns to the shop projection in `src/lib/shops.functions.ts` so `/shop/$slug` receives them; render a new `src/components/social-links.tsx` (presentational) in `src/routes/shop.$slug.tsx`, and extend that route's JSON-LD with `sameAs`.
- Owner UI: new `src/components/shop-links-panel.tsx` mounted as a `Links` tab in `src/routes/_authenticated/owner.tsx`, mirroring the existing details-form patterns (local state, mutation, `sonner` toast).
- Tour: new `src/components/setup-tour.tsx` implementing a spotlight overlay with `data-tour="<step-id>"` attributes added to the existing dashboard elements, measured with `getBoundingClientRect` and a fixed-position highlight + tooltip; no new dependency. State (`dismissed`, `lastStep`, `completed`) persists in `localStorage` keyed by shop id, read inside `useEffect` to avoid hydration mismatch. Tab switching driven by lifting the existing `Tabs` `defaultValue` to controlled state.
- Completion status per step derives from data already loaded on the dashboard (shop fields, services list, hours rows, payout account, link fields) — no extra queries.
- `docs/data-mapping.md` updated with the new shop columns.
