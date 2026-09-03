import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";

import { AccountNav } from "@/components/account-nav";
import {
  listOwnerSignups,
  listOwnerTrialEvents,
  type OwnerSignupRow,
} from "@/lib/admin.functions";

const ownerSignupsQuery = queryOptions({
  queryKey: ["admin", "owner-signups"],
  queryFn: () => listOwnerSignups(),
});

const STATE_LABEL: Record<string, string> = {
  none: "No plan",
  trialing: "In trial",
  active: "Paid",
  past_due: "Past due",
  canceled: "Canceled",
  lifetime: "Lifetime",
};

const FILTERS = ["all", "trialing", "active", "none", "canceled", "lifetime"] as const;
type Filter = (typeof FILTERS)[number];

export const Route = createFileRoute("/_authenticated/admin_/owners")({
  head: () => ({
    meta: [
      { title: "Shop owner signups — The Standing Chair" },
      {
        name: "description",
        content:
          "Admin view of every new shop owner signup, trial status and conversion state on The Standing Chair.",
      },
      { property: "og:title", content: "Shop owner signups — The Standing Chair" },
      {
        property: "og:description",
        content: "Track new shop owners, active trials and paid conversions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ownerSignupsQuery),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 text-on-surface bg-background">
      <div>
        <h1 className="font-headline-md text-headline-md mb-2">Something went wrong</h1>
        <p className="text-on-surface-variant">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-on-surface">Not found.</div>,
  component: AdminOwnersPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <header className="border-b border-border-subtle bg-surface">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between gap-4">
          <Link to="/" className="font-headline-md text-headline-md text-primary tracking-tight">
            The Standing Chair
          </Link>
          <AccountNav />
        </div>
      </header>
      <main className="max-w-container-max mx-auto p-margin-mobile md:p-margin-desktop flex flex-col gap-6">
        {children}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-5">
      <p className="text-label-md text-on-surface-variant uppercase tracking-wide">{label}</p>
      <p className="font-headline-md text-headline-md text-on-surface">{value}</p>
    </div>
  );
}

function trialCell(row: OwnerSignupRow): string {
  if (row.trialDaysLeft === null) return "—";
  if (row.trialDaysLeft < 0) return "Ended";
  return `${row.trialDaysLeft} day${row.trialDaysLeft === 1 ? "" : "s"} left`;
}

function TrialHistory({ shopId }: { shopId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "trial-events", shopId],
    queryFn: () => listOwnerTrialEvents({ data: { shopId } }),
  });

  if (isLoading) return <p className="text-body-sm text-on-surface-variant">Loading history…</p>;
  if (!data || data.access === "denied" || data.rows.length === 0)
    return <p className="text-body-sm text-on-surface-variant">No trial history recorded yet.</p>;

  return (
    <ol className="flex flex-col gap-1">
      {data.rows.map((e) => (
        <li key={e.id} className="text-body-md text-on-surface-variant">
          <span className="text-on-surface">{e.eventLabel}</span>{" "}
          <span className="text-body-sm">
            — {new Date(e.occurredAt).toLocaleString(undefined, { dateStyle: "medium" })}
            {e.source ? ` · ${e.source}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

function AdminOwnersPage() {
  const { data } = useSuspenseQuery(ownerSignupsQuery);
  const [filter, setFilter] = useState<Filter>("all");
  const [openShopId, setOpenShopId] = useState<string | null>(null);
  const allRows = data.access === "granted" ? data.rows : [];
  const rows = useMemo(
    () => (filter === "all" ? allRows : allRows.filter((r) => r.planState === filter)),
    [allRows, filter],
  );

  if (data.access === "denied") {
    return (
      <Shell>
        <div className="bg-surface border border-border-subtle rounded-xl p-8">
          <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Not available</h1>
          <p className="text-on-surface-variant text-body-md">
            This page is only available to administrators.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div>
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Shop owner signups
        </h1>
        <p className="text-on-surface-variant text-body-md mt-1">
          Every owner who has created a shop, with their trial and conversion state.
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-gutter">
        <Stat label="Total signups" value={data.totals.all} />
        <Stat label="This week" value={data.totals.thisWeek} />
        <Stat label="Last 30 days" value={data.totals.thisMonth} />
        <Stat label="Trials ending ≤14d" value={data.totals.trialsEndingSoon} />
        <Stat label="Signup trials (no card)" value={data.totals.signupTrialsNoCard} />
        <Stat label="Signup trials ending ≤14d" value={data.totals.signupTrialsEndingSoon} />
      </div>

      {data.sources.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-xl p-5">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wide mb-3">
            How they heard about us
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {data.sources.map((s) => (
              <div key={s.value} className="flex items-baseline gap-2">
                <span className="font-headline-md text-headline-md text-on-surface">{s.count}</span>
                <span className="text-body-md text-on-surface-variant">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.campaignSources.length > 0 || data.campaigns.length > 0) && (
        <div className="bg-surface border border-border-subtle rounded-xl p-5 flex flex-col gap-4">
          <div>
            <p className="text-label-md text-on-surface-variant uppercase tracking-wide mb-3">
              Campaign link source
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {data.campaignSources.map((s) => (
                <div key={s.value} className="flex items-baseline gap-2">
                  <span className="font-headline-md text-headline-md text-on-surface">
                    {s.count}
                  </span>
                  <span className="text-body-md text-on-surface-variant">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-label-md text-on-surface-variant uppercase tracking-wide mb-3">
              Campaign
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {data.campaigns.map((s) => (
                <div key={s.value} className="flex items-baseline gap-2">
                  <span className="font-headline-md text-headline-md text-on-surface">
                    {s.count}
                  </span>
                  <span className="text-body-md text-on-surface-variant">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`text-label-md rounded-full px-3 py-1.5 border transition-colors ${
              filter === f
                ? "border-primary text-primary bg-primary/10"
                : "border-border-subtle text-on-surface-variant hover:text-primary"
            }`}
          >
            {f === "all" ? "All" : STATE_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border-subtle rounded-xl overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border-subtle">
              {["Signed up", "Shop", "Owner", "Email", "Plan", "Trial", "Source", "Campaign", ""].map(
                (h, i) => (
                <th
                  key={h || `col-${i}`}
                  className="text-label-md text-on-surface-variant uppercase tracking-wide px-4 py-3 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-on-surface-variant text-body-md">
                  No signups to show yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <Fragment key={r.shopId}>
              <tr className="border-b border-border-subtle">
                <td className="px-4 py-3 text-on-surface whitespace-nowrap">
                  {new Date(r.signedUpAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </td>
                <td className="px-4 py-3 text-on-surface">
                  <Link to="/shop/$slug" params={{ slug: r.shopSlug }} className="hover:text-primary">
                    {r.shopName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-on-surface-variant">{r.ownerName ?? "—"}</td>
                <td className="px-4 py-3 text-on-surface-variant">{r.ownerEmail ?? "—"}</td>
                <td className="px-4 py-3 text-on-surface whitespace-nowrap">
                  {STATE_LABEL[r.planState] ?? r.planState}
                </td>
                <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                  {trialCell(r)}
                  {r.trialSource !== "none" && (
                    <span className="ml-2 text-label-sm rounded-full border border-border-subtle px-2 py-0.5">
                      {r.trialSourceLabel}
                    </span>
                  )}
                </td>
                <td
                  className="px-4 py-3 text-on-surface-variant whitespace-nowrap"
                  title={r.heardAboutDetail ?? undefined}
                >
                  {r.heardAboutLabel}
                  {r.heardAboutDetail ? " *" : ""}
                </td>
                <td
                  className="px-4 py-3 text-on-surface-variant whitespace-nowrap"
                  title={
                    [r.utmCampaign, r.utmContent].filter(Boolean).join(" · ") || undefined
                  }
                >
                  {r.utmSource ? `${r.utmSource}${r.utmMedium ? ` · ${r.utmMedium}` : ""}` : "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setOpenShopId((prev) => (prev === r.shopId ? null : r.shopId))}
                    className="text-label-md text-on-surface-variant hover:text-primary"
                  >
                    {openShopId === r.shopId ? "Hide history" : "History"}
                  </button>
                </td>
              </tr>
              {openShopId === r.shopId && (
                <tr className="border-b border-border-subtle bg-surface-container">
                  <td colSpan={9} className="px-4 py-4">
                    <p className="text-label-md text-on-surface-variant uppercase tracking-wide mb-2">
                      Trial history
                    </p>
                    <TrialHistory shopId={r.shopId} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
