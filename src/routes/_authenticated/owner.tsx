import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AccountNav } from "@/components/account-nav";
import { getMyShops, getShopDetail } from "@/lib/shops.functions";

const myShopsQuery = queryOptions({
  queryKey: ["owner", "shops"],
  queryFn: () => getMyShops(),
});

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "Shop Owner Dashboard — Crown & Cut" },
      { name: "description", content: "Manage your shops, services and bookings." },
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
  notFoundComponent: () => (
    <div className="p-8 text-on-surface">Not found.</div>
  ),
  component: OwnerPage,
});

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

function OwnerPage() {
  const { data: shops } = useSuspenseQuery(myShopsQuery);
  const [selectedId, setSelectedId] = useState<string | null>(shops[0]?.id ?? null);

  if (shops.length === 0) {
    return (
      <div className="min-h-screen bg-background text-on-background flex items-center justify-center px-4">
        <div className="max-w-md text-center flex flex-col gap-4">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            You don't have a shop yet
          </h1>
          <p className="text-on-surface-variant text-body-md">
            Create your first shop to start accepting bookings.
          </p>
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
      <header className="border-b border-border-subtle bg-surface">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-headline-md text-headline-md text-primary tracking-tight">
              Crown &amp; Cut
            </Link>
            <span className="hidden md:inline font-label-md text-label-md text-on-surface-variant">
              Owner Dashboard
            </span>
          </div>
          <AccountNav />
        </div>
      </header>

      <main className="max-w-container-max mx-auto p-margin-mobile md:p-margin-desktop flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              {selected.name}
            </h1>
            {selected.address && (
              <p className="text-on-surface-variant text-body-md mt-1 flex items-center gap-1">
                <Icon name="location_on" className="text-[16px]" /> {selected.address}
              </p>
            )}
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

        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          <StatCard icon="event_available" label="Bookings today" value={selected.today_bookings} />
          <StatCard icon="content_cut" label="Active services" value={selected.services_count} />
          <StatCard icon="groups" label="Barbers" value={selected.barbers_count} />
        </section>

        <ServicesPanel shopId={selected.id} />

        <div className="flex flex-wrap gap-3">
          <Link
            to="/onboarding/owner"
            className="bg-surface border border-border-subtle text-on-surface rounded-lg px-4 py-2 hover:border-primary transition-colors font-label-md"
          >
            + Create another shop
          </Link>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-6 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon name={icon} className="text-primary" />
        <span className="font-label-md text-label-md">{label}</span>
      </div>
      <span className="font-headline-lg text-headline-lg text-on-surface">{value}</span>
    </div>
  );
}

function ServicesPanel({ shopId }: { shopId: string }) {
  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey: ["owner", "shop", shopId],
      queryFn: () => getShopDetail({ data: { shopId } }),
    }),
  );

  return (
    <section className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-4">
        <h2 className="font-headline-md text-[20px] font-semibold text-on-surface">Services</h2>
        <span className="text-label-sm text-on-surface-variant">
          {data.services.length} total
        </span>
      </div>
      {data.services.length === 0 ? (
        <p className="text-on-surface-variant text-body-md">
          No services yet — add some from the onboarding flow to get bookings.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle">
          {data.services.map((s) => (
            <li key={s.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-label-md text-label-md text-on-surface">{s.name}</p>
                <p className="text-label-sm text-on-surface-variant">
                  {s.duration_minutes} min
                  {!s.is_active && " · inactive"}
                </p>
              </div>
              <span className="font-label-md text-label-md text-on-surface">
                ${(s.price_cents / 100).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
