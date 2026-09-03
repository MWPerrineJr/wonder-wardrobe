import { Link } from "@tanstack/react-router";

import { PLAN_TIERS } from "@/lib/stripe";

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const DEMO_STEPS = [
  {
    icon: "storefront",
    title: "Publish your shop page",
    body: "Add your services, prices, weekly hours and social links once. You get a clean public page and a shareable booking link — no website needed.",
  },
  {
    icon: "event_available",
    title: "Take bookings around the clock",
    body: "Clients pick a service, a provider and a time that fits your real hours. Double bookings are blocked at the database level.",
  },
  {
    icon: "credit_card",
    title: "Get paid up front",
    body: "Turn on full prepayment or a deposit. Payouts land in your own connected account, so no-shows stop costing you the chair.",
  },
  {
    icon: "mark_email_read",
    title: "Automatic post-visit surveys",
    body: "A day after each appointment your client gets a short survey. Happy clients are pointed to your Google review link; unhappy ones stay private with you.",
  },
  {
    icon: "psychology",
    title: "Feedback Intelligence",
    body: "Every response is scored for sentiment, emotion and urgency, then summarised with key phrases and a suggested reply you can send as-is.",
  },
  {
    icon: "query_stats",
    title: "Business analytics",
    body: "Revenue by service, bookings per day, peak hours, sales per provider and survey ratings — charted daily, weekly or monthly.",
  },
] as const;

/** Guided product tour, reused by /demo and the chrome-free /demo/embed view. */
export function DemoTour({
  sampleSlug,
  compact = false,
}: {
  sampleSlug?: string | null;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <p className="text-label-md text-primary uppercase tracking-wide">Product tour</p>
        <h1
          className={
            compact
              ? "font-headline-md text-headline-md text-on-surface"
              : "font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface"
          }
        >
          Everything your shop needs, in one link
        </h1>
        <p className="text-body-md text-on-surface-variant max-w-2xl">
          The Standing Chair gives barbers, nail techs, estheticians, makeup artists and massage
          therapists a bookable page, prepayments, automated client surveys and AI-backed analytics.
          Listing and bookings are free — analytics is the paid add-on.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/onboarding/owner"
            className="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg font-bold hover:bg-primary/90"
          >
            Start free
          </Link>
          {sampleSlug ? (
            <Link
              to="/shop/$slug"
              params={{ slug: sampleSlug }}
              className="border border-border-subtle text-on-surface font-label-md text-label-md px-6 py-3 rounded-lg hover:border-primary hover:text-primary"
            >
              Try a live booking page
            </Link>
          ) : (
            <Link
              to="/shop"
              className="border border-border-subtle text-on-surface font-label-md text-label-md px-6 py-3 rounded-lg hover:border-primary hover:text-primary"
            >
              Browse live shops
            </Link>
          )}
        </div>
      </section>

      <ol className="grid md:grid-cols-2 gap-gutter">
        {DEMO_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm flex gap-4"
          >
            <div className="shrink-0 size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Icon name={step.icon} className="text-[22px]" />
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant">Step {index + 1}</p>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{step.title}</h3>
              <p className="text-body-md text-on-surface-variant mt-1">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">Simple pricing</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-gutter">
          <div className="bg-surface border border-border-subtle rounded-xl p-6">
            <p className="text-label-md text-on-surface-variant uppercase tracking-wide">Free</p>
            <p className="font-headline-md text-headline-md text-on-surface">$0 / month</p>
            <p className="text-label-sm text-on-surface-variant">
              Shop page, booking link, services, hours and appointments.
            </p>
          </div>
          {PLAN_TIERS.map((tier) => (
            <div key={tier.id} className="bg-surface border border-border-subtle rounded-xl p-6">
              <p className="text-label-md text-primary uppercase tracking-wide">{tier.name}</p>
              <p className="font-headline-md text-headline-md text-on-surface">
                {tier.monthlyLabel}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                {tier.providers} · {tier.yearlyLabel} annually
              </p>
              <p className="text-label-sm text-on-surface-variant mt-1">
                90-day free trial. Cancel any time in one click.
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
