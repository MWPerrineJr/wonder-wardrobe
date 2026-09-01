# Easy cancel + shareable product demo

## 1. One-click cancel subscription

Add a clear "Cancel subscription" control next to Manage billing on the plans
page (`/owner/subscribe`) and in the upgrade panel, for shops with a
`trialing` / `active` / `past_due` subscription.

Behaviour:

- Confirm dialog states exactly what happens: analytics, surveys and
  Feedback Intelligence stay available until the end of the current paid
  period; bookings, services, hours and the public shop page are unaffected.
- Cancels at period end (not immediately), so nothing is lost mid-cycle.
- After cancelling, the card shows "Cancels on <date>" plus a
  "Resume subscription" button that undoes it while the period is still open.
- Manage billing (card, invoices, plan switch) stays where it is.
- Shops on lifetime complimentary access see no cancel control.

## 2. Demo page (`/demo`)

A public, no-sign-in guided product tour page:

- Hero with a one-line pitch and a "Start free" call to action.
- Numbered walkthrough sections: publish your shop page and booking link,
  take bookings and prepayments, post-visit surveys, Feedback Intelligence,
  business analytics — each with a short explanation and a visual.
- A live sample shop link so visitors can try the real booking flow.
- Plan summary (Free / Solo / Team / Enterprise) linking to the plans page.
- Its own SEO metadata and social preview tags so shared links look right.

## 3. Share + embed

On the demo page and on `/owner/subscribe`:

- Copy-link button for the demo URL.
- Share buttons: X, Facebook, LinkedIn, WhatsApp, email.
- An "Embed on your website" box with a copyable `<iframe>` snippet pointing
  at a compact embed view of the demo, so it drops into any site builder.
- The embed view renders the tour without the app header/footer chrome.

## Technical notes

- New `cancelSubscription` / `resumeSubscription` server functions in
  `src/lib/billing.functions.ts`, owner-verified through RLS, calling
  `stripe.subscriptions.update(id, { cancel_at_period_end })` via
  `createStripeClient`, with errors returned as messages (not raw 500s).
  `getBillingStatus` already returns `cancelAtPeriodEnd` and
  `currentPeriodEnd`, so the UI state comes from a refetch; the webhook keeps
  the row authoritative.
- Cancel/resume UI lives in `src/components/analytics-upgrade-panel.tsx`
  (new subscription-status card) reused by `/owner/subscribe`.
- New public routes `src/routes/demo.tsx` (full tour, SSR, own `head()`) and
  `src/routes/demo.embed.tsx` (chrome-free variant for the iframe).
- New `src/components/share-embed.tsx` with copy-link, social share links and
  the iframe snippet; used on `/demo` and `/owner/subscribe`.
- Demo/embed URLs are built from the request origin so preview and published
  domains both work.
