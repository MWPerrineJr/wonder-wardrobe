import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AccountNav } from "@/components/account-nav";
import {
  AnalyticsUpgradePanel,
  ManageBillingButton,
} from "@/components/analytics-upgrade-panel";
import {
  BookingsTrend,
  LostBookingsTrend,
  ProviderPerformance,
  RetentionPanel,
  RevenueTrend,
  ServicePerformance,
  SurveyPanel,
  UtilizationHeatmap,
} from "@/components/analytics/charts";
import { KpiCard, money, pct } from "@/components/analytics/shared";
import { PaymentTestModeBanner } from "@/components/payment-test-banner";
import { getShopAnalytics } from "@/lib/analytics.functions";
import { ANALYTICS_RANGES } from "@/lib/analytics-types";
import { getMyShops } from "@/lib/shops.functions";
import { getStripeEnvironment } from "@/lib/stripe";

const myShopsQuery = queryOptions({
  queryKey: ["owner", "shops"],
  queryFn: () => getMyShops(),
});

export const Route = createFileRoute("/_authenticated/owner_/analytics")({
  head: () => ({
    meta: [
      { title: "Business Analytics — The Standing Chair" },
      {
        name: "description",
        content:
          "Track revenue, bookings, service and provider performance, survey ratings and capacity for your business.",
      },
      { property: "og:title", content: "Business Analytics — The Standing Chair" },
      {
        property: "og:description",
        content: "Revenue, bookings, provider performance and survey insights for your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  component: AnalyticsPage,
});

const RANGE_LABELS: Record<number, string> = {
  7: "7 days",
  30: "30 days",
  90: "90 days",
  365: "12 months",
};

function AnalyticsPage() {
  const { data: shops } = useSuspenseQuery(myShopsQuery);
  const [selectedId, setSelectedId] = useState<string | null>(shops[0]?.id ?? null);
  const [days, setDays] = useState<number>(30);

  if (shops.length === 0) {
    return (
      <div className="min-h-screen bg-background text-on-background flex items-center justify-center px-4">
        <div className="max-w-md text-center flex flex-col gap-4">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            You don't have a shop yet
          </h1>
          <Link
            to="/onboarding/owner"
            className="mx-auto bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-all"
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
          <div className="flex items-center gap-6">
            <Link to="/" className="font-headline-md text-headline-md text-primary tracking-tight">
              The Standing Chair
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-label-md">
              <Link to="/owner" className="text-on-surface-variant hover:text-on-surface">
                Dashboard
              </Link>
              <Link to="/owner/analytics" className="text-primary font-semibold">
                Analytics
              </Link>
              <Link to="/owner/feedback" className="text-on-surface-variant hover:text-on-surface">
                Feedback
              </Link>
              <Link to="/owner/support" className="text-on-surface-variant hover:text-on-surface">
                Support
              </Link>
            </nav>
          </div>
          <AccountNav />
        </div>
      </header>

      <main className="max-w-container-max mx-auto p-margin-mobile md:p-margin-desktop flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              Business Analytics
            </h1>
            <p className="text-on-surface-variant text-body-md mt-1">
              Sales, bookings and customer insights for {selected.name}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex rounded-lg border border-border-subtle bg-surface overflow-hidden">
              {ANALYTICS_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDays(r)}
                  className={`px-3 py-2 text-label-sm transition-colors ${
                    days === r
                      ? "bg-primary text-on-primary font-semibold"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <AnalyticsContent shopId={selected.id} days={days} />
      </main>
    </div>
  );
}

function AnalyticsContent({ shopId, days }: { shopId: string; days: number }) {
  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey: ["owner", "analytics", shopId, days],
      queryFn: () =>
        getShopAnalytics({ data: { shopId, days, environment: getStripeEnvironment() } }),
    }),
  );

  if (data.locked) {
    return <AnalyticsUpgradePanel shopId={shopId} />;
  }

  const { kpis, series, services, providers, surveys, utilization, retention } = data;

  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Booked revenue"
          value={money(kpis.revenueBookedCents.current)}
          trend={kpis.revenueBookedCents}
        />
        <KpiCard
          label="Collected"
          value={money(kpis.revenueCollectedCents.current)}
          trend={kpis.revenueCollectedCents}
          hint="Prepayments only"
        />
        <KpiCard
          label="Appointments"
          value={String(kpis.appointments.current)}
          trend={kpis.appointments}
        />
        <KpiCard
          label="Avg ticket"
          value={money(kpis.avgTicketCents.current)}
          trend={kpis.avgTicketCents}
        />
        <KpiCard
          label="Completion rate"
          value={pct(kpis.completionRate.current, 0)}
          trend={kpis.completionRate}
        />
        <KpiCard
          label="Avg rating"
          value={kpis.avgRating.current === 0 ? "—" : kpis.avgRating.current.toFixed(2)}
          // No survey responses in a period isn't a rating drop, so only compare
          // when both periods actually have ratings.
          trend={
            kpis.avgRating.current > 0 && kpis.avgRating.previous > 0 ? kpis.avgRating : undefined
          }
          hint={
            kpis.avgRating.current === 0 ? "No ratings yet" : "No ratings in the previous period"
          }
        />
      </section>

      <RevenueTrend series={series} />
      <BookingsTrend series={series} />

      <div className="grid gap-gutter lg:grid-cols-2">
        <LostBookingsTrend series={series} />
        <RetentionPanel retention={retention} />
      </div>

      <ServicePerformance services={services} />
      <ProviderPerformance providers={providers} />

      <div className="grid gap-gutter lg:grid-cols-2">
        <SurveyPanel surveys={surveys} />
        <UtilizationHeatmap utilization={utilization} />
      </div>

      <div className="flex justify-end">
        <ManageBillingButton shopId={shopId} />
      </div>
    </>
  );
}