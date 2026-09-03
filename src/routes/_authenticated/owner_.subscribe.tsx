import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AccountNav } from "@/components/account-nav";
import { AnalyticsUpgradePanel } from "@/components/analytics-upgrade-panel";
import { PaymentTestModeBanner } from "@/components/payment-test-banner";
import { ShareEmbed } from "@/components/share-embed";
import { getMyShops } from "@/lib/shops.functions";

const myShopsQuery = queryOptions({
  queryKey: ["owner", "shops"],
  queryFn: () => getMyShops(),
});

export const Route = createFileRoute("/_authenticated/owner_/subscribe")({
  head: () => ({
    meta: [
      { title: "Choose your Analytics plan — The Standing Chair" },
      {
        name: "description",
        content:
          "Pick the Analytics plan that matches your team size and start a 90-day free trial.",
      },
      { property: "og:title", content: "Choose your Analytics plan — The Standing Chair" },
      {
        property: "og:description",
        content: "Solo, Team and Enterprise plans for shops with multiple providers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myShopsQuery),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 text-on-surface bg-background">
      <div>
        <h1 className="font-headline-md text-headline-md mb-2">Something went wrong</h1>
        <p className="text-on-surface-variant">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-on-surface">Not found.</div>,
  component: SubscribePage,
});

function SubscribePage() {
  const navigate = useNavigate();
  const { data: shops } = useSuspenseQuery(myShopsQuery);
  const [selectedId, setSelectedId] = useState<string | null>(shops[0]?.id ?? null);

  if (shops.length === 0) {
    return (
      <div className="min-h-screen bg-background text-on-background flex items-center justify-center px-4">
        <div className="max-w-md text-center flex flex-col gap-4">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            You don't have a shop yet
          </h1>
          <Link
            to="/onboarding/owner"
            className="mx-auto bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg font-bold hover:bg-primary/90"
          >
            Set up your shop
          </Link>
        </div>
      </div>
    );
  }

  const selected = shops.find((s) => s.id === selectedId) ?? shops[0];

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <PaymentTestModeBanner />
      <header className="border-b border-border-subtle bg-surface">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between gap-4">
          <Link to="/" className="font-headline-md text-headline-md text-primary tracking-tight">
            The Standing Chair
          </Link>
          <AccountNav />
        </div>
      </header>

      <main className="max-w-container-max mx-auto p-margin-mobile md:p-margin-desktop flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              Choose your plan
            </h1>
            <p className="text-on-surface-variant text-body-md mt-1">
              {selected.name} is live and taking bookings for free. Add surveys and AI analytics
              whenever you're ready — or redeem a comp code if you have one.
            </p>
          </div>
          {shops.length > 1 && (
            <select
              value={selected.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-surface border border-border-subtle rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <AnalyticsUpgradePanel shopId={selected.id} />

        <ShareEmbed
          heading="Show clients what they get"
          blurb="Share the guided tour of The Standing Chair, or embed it on your own website and post it to social media."
        />

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => navigate({ to: "/owner" })}
            className="text-label-md text-on-surface-variant hover:text-primary underline-offset-2 hover:underline"
          >
            Continue to dashboard
          </button>
        </div>
      </main>
    </div>
  );
}
