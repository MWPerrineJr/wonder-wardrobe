# Delete shop on the live site + client email

Two things: get the existing Delete shop control onto your published site, and set up real email so clients get booking confirmations, reminders, and the post-visit survey from your own domain.

## 1. Delete shop

The Delete shop button already exists in the owner dashboard, in the Overview tab next to "Create another shop". It confirms in a dialog and permanently removes the shop plus its services, providers, bookings, feedback, and settings.

It's missing on thestandingchair.com because the live site is running an older published build. Fix: publish an update. To make it easier to find, I'll also add a Delete shop action at the bottom of the Shop details tab (same confirmation dialog, same behavior).

## 2. Sending email to clients

Your app currently prepares survey emails but has no verified sender, so nothing sends. I'll set up sending on a subdomain of thestandingchair.com (something like notify.thestandingchair.com) so your main domain and website keep working untouched. This is done through the built-in email setup — no third-party API keys — and you'll add a couple of DNS records once.

Then I'll build three branded emails, styled with the Warm Stone palette and Outfit/Figtree type:

- **Booking confirmation** — sent when a client books: shop, provider, service, date/time, deposit paid and balance due, cancellation window, and Add to Calendar links.
- **Booking reminder** — sent the day before the appointment, with cancel/reschedule links.
- **Post-visit survey** — the existing 24-hour feedback email, moved onto the new sender, with the Google review link shown only for happy responses.

Every outgoing client email will use From: your shop's name at the sending subdomain and Reply-To: support@thestandingchair.com, so replies land in your support inbox.

## 3. Support inbox (support@thestandingchair.com)

You want to actually receive replies. Sending and receiving are separate: the setup above only sends. To receive mail at support@thestandingchair.com you need mailbox hosting — Google Workspace, Microsoft 365, Fastmail, or free forwarding from your registrar/Cloudflare. That's a step you do outside the app, and it doesn't conflict with the sending subdomain.

Once it exists, the address will appear in the app: a Support link in the footer and in the account menu, and on your shops' public pages as the contact for booking help.

If you'd rather not add mailbox hosting yet, I can point support at the email on your owner account instead and swap it later.

## Technical details

- **Delete shop UI**: `src/routes/_authenticated/owner.tsx` — the existing `AlertDialog` + `deleteShopMutation` stays in Overview; add the same pattern to the Shop details panel. `deleteShop` in `src/lib/owner.functions.ts` is unchanged (ownership-verified, cascades child rows).
- **Email infrastructure**: configure the sender subdomain, then provision the email queue/log tables and the send/preview/unsubscribe/queue routes under `/lovable/email/*`. Requires `src/start.ts` middleware and root `beforeLoad` to pass `/lovable/*` through untouched.
- **Templates**: React Email `.tsx` files in `src/lib/email-templates/` (`booking-confirmation`, `booking-reminder`, `post-visit-survey`), each registered in `registry.ts`.
- **Triggers**: booking confirmation sends from the booking server function after a successful insert, keyed by booking id for idempotency; the reminder and survey run off the existing cron job routes in `src/routes/api/public/jobs/`, with a new reminder job querying bookings ~24h out. `src/lib/survey-email.server.ts` is rewired to the new send path.
- **Support address**: stored as a single constant/config value so it renders in the footer, account menu, and public shop pages, and is used as Reply-To on all outgoing client email.
- Emails send from the published site, so this needs a publish to go live.
