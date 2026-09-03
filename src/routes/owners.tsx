import { createFileRoute, Link } from "@tanstack/react-router";

import { AccountNav } from "@/components/account-nav";
import { SiteBrand } from "@/components/site-brand";

export const Route = createFileRoute("/owners")({
  head: () => ({
    meta: [
      { title: "Become a shop owner — The Standing Chair" },
      {
        name: "description",
        content:
          "List your salon, spa, or studio on The Standing Chair. Get discovered, take bookings, and grow your business with a 90-day free trial.",
      },
      {
        property: "og:title",
        content: "Become a shop owner — The Standing Chair",
      },
      {
        property: "og:description",
        content:
          "List your salon, spa, or studio on The Standing Chair. Get discovered, take bookings, and grow your business with a 90-day free trial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnersLandingPage,
});

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const VALUE_PROPS = [
  {
    icon: "calendar_month",
    title: "Online bookings",
    description: "Let clients book appointments 24/7 without the back-and-forth.",
  },
  {
    icon: "person_raised_hand",
    title: "Built for providers",
    description: "Built for salons, spas, barbers, estheticians, massage therapists, and more.",
  },
  {
    icon: "insights",
    title: "Built-in analytics",
    description: "Track revenue, bookings, and customer trends to make smarter decisions.",
  },
  {
    icon: "verified",
    title: "90-day free trial",
    description: "No upfront cost. Start taking bookings and see the value before you pay.",
  },
];

function OwnersLandingPage() {
  return (
    <div className="bg-background min-h-screen flex flex-col text-on-background">
      {/* Top nav */}
      <header className="w-full border-b border-border-subtle">
        <div className="flex justify-between items-center px-margin-desktop h-16 max-w-container-max mx-auto w-full">
          <SiteBrand />
          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/"
              className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md px-2 py-1 rounded"
            >
              Marketplace
            </Link>
            <Link
              to="/shop"
              className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md px-2 py-1 rounded"
            >
              Shops
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <AccountNav />
            <Link
              to="/onboarding/owner"
              className="bg-primary text-on-primary font-label-md text-label-md px-5 py-2 rounded font-bold hover:opacity-90 transition-opacity"
            >
              Start your shop
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col">
        {/* Hero */}
        <section className="w-full border-b border-border-subtle">
          <div className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-16 md:py-24 flex flex-col items-center text-center gap-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 font-label-sm text-label-sm text-on-surface-variant">
              <Icon name="storefront" className="text-[16px] text-primary" />
              Now welcoming founding shop owners
            </span>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface max-w-3xl">
              Turn your chair into a booking business
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
              Join The Standing Chair and get discovered by clients looking for their next salon,
              spa, or studio appointment. Setup takes minutes, bookings start immediately.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                to="/onboarding/owner"
                className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity"
              >
                Start your free 90-day trial
              </Link>
              <Link
                to="/auth"
                className="text-primary font-label-md text-label-md font-semibold hover:underline"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </section>

        {/* Value props */}
        <section className="w-full">
          <div className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-16 md:py-24">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {VALUE_PROPS.map((prop) => (
                <div
                  key={prop.title}
                  className="bg-surface border border-border-subtle rounded-xl p-6 flex flex-col gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Icon name={prop.icon} />
                  </div>
                  <h3 className="font-headline-md text-[20px] text-on-surface">{prop.title}</h3>
                  <p className="text-on-surface-variant text-body-md">{prop.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="w-full border-t border-border-subtle">
          <div className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-16 md:py-24 flex flex-col items-center text-center gap-6">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Ready to grow your business?
            </h2>
            <p className="text-on-surface-variant text-body-lg max-w-xl">
              Create your shop in minutes, add your services, and start taking bookings today.
            </p>
            <Link
              to="/onboarding/owner"
              className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity"
            >
              Create your shop
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border-subtle py-8">
        <div className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-4 text-on-surface-variant text-body-md">
          <SiteBrand />
          <span>© {new Date().getFullYear()} The Standing Chair</span>
        </div>
      </footer>
    </div>
  );
}
