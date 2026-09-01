import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SubscriptionStatusCard } from "@/components/subscription-status-card";
import {
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
  redeemCompCode,
  type BillingStatus,
} from "@/lib/billing.functions";
import {
  PLAN_TIERS,
  getStripe,
  getStripeEnvironment,
  tierForProviderCount,
  type AnalyticsPriceId,
  type PlanTierId,
} from "@/lib/stripe";

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const FREE_FEATURES = [
  "Public shop page and shareable booking link",
  "Unlimited service listings with pricing",
  "Weekly hours and provider calendar",
  "Online bookings and appointment management",
];

const PAID_FEATURES = [
  "Automated post-visit email surveys",
  "AI sentiment, emotion and urgency analysis",
  "Summaries, key phrases and recommended replies",
  "Feedback KPIs and business analytics dashboards",
];

type BillingCycle = "monthly" | "yearly";

export function AnalyticsUpgradePanel({ shopId }: { shopId: string }) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [tierId, setTierId] = useState<PlanTierId | null>(null);
  const [checkoutPriceId, setCheckoutPriceId] = useState<AnalyticsPriceId | null>(null);

  const { data: status } = useQuery({
    queryKey: ["owner", "billing", shopId],
    queryFn: () => getBillingStatus({ data: { shopId, environment: getStripeEnvironment() } }),
  });

  const providerCount = status?.providerCount ?? 0;
  const recommended = tierForProviderCount(providerCount);
  const selectedTier = PLAN_TIERS.find((t) => t.id === (tierId ?? recommended)) ?? PLAN_TIERS[0];

  if (status?.lifetime) {
    return <LifetimeAccessPanel status={status} shopId={shopId} />;
  }

  const hasSubscription =
    status && ["trialing", "active", "past_due"].includes(status.status ?? "");
  if (status && (hasSubscription || (status.status && status.cancelAtPeriodEnd))) {
    return (
      <section className="flex flex-col gap-6">
        <SubscriptionStatusCard shopId={shopId} status={status} />
        <div className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm">
          <p className="text-label-md text-on-surface uppercase tracking-wide mb-3">
            What's included
          </p>
          <FeatureList items={PAID_FEATURES} />
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-surface border border-border-subtle rounded-xl p-8 shadow-sm flex flex-col items-center text-center gap-3">
        <Icon name="query_stats" className="text-[40px] text-primary" />
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Analytics is a paid add-on
        </h2>
        <p className="text-on-surface-variant text-body-md max-w-xl">
          Listing your services and taking bookings is free, forever. Survey automation, AI feedback
          analysis and business analytics are part of the Analytics plan — start with a{" "}
          1-month free trial. Pricing scales with the number of providers in your shop
          {providerCount > 0 ? ` (you have ${providerCount}).` : "."}
        </p>
      </div>

      <div className="flex gap-2 justify-center">
        <CycleButton active={cycle === "monthly"} onClick={() => setCycle("monthly")}>
          Monthly
        </CycleButton>
        <CycleButton active={cycle === "yearly"} onClick={() => setCycle("yearly")}>
          Annual
        </CycleButton>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-gutter">
        <div className="bg-surface border border-border-subtle rounded-xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-label-md text-on-surface-variant uppercase tracking-wide">Free</p>
            <p className="font-headline-md text-headline-md text-on-surface">$0 / month</p>
            <p className="text-label-sm text-on-surface-variant">Any number of providers</p>
          </div>
          <FeatureList items={FREE_FEATURES} />
          <p className="text-label-sm text-on-surface-variant mt-auto">Your current plan.</p>
        </div>

        {PLAN_TIERS.map((tier) => {
          const isRecommended = tier.id === recommended;
          const isSelected = tier.id === selectedTier.id;
          const priceId = cycle === "monthly" ? tier.monthlyPriceId : tier.yearlyPriceId;
          return (
            <div
              key={tier.id}
              className={`bg-surface rounded-xl p-6 flex flex-col gap-4 shadow-sm border-2 transition-colors ${
                isSelected ? "border-primary" : "border-border-subtle"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-label-md text-primary uppercase tracking-wide">{tier.name}</p>
                  {isRecommended && (
                    <span className="text-label-sm bg-primary/10 text-primary rounded-full px-2 py-0.5">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="font-headline-md text-headline-md text-on-surface">
                  {cycle === "monthly" ? tier.monthlyLabel : tier.yearlyLabel}
                </p>
                <p className="text-label-sm text-on-surface-variant">{tier.providers}</p>
                <p className="text-label-sm text-on-surface-variant">
                  {cycle === "monthly" ? "Billed monthly, cancel anytime." : tier.yearlySavings}
                </p>
              </div>

              <FeatureList items={PAID_FEATURES} />

              <Button
                className="font-bold mt-auto"
                variant={isRecommended ? "default" : "outline"}
                onClick={() => {
                  setTierId(tier.id);
                  setCheckoutPriceId(priceId);
                }}
              >
                Start 1-month free trial
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center">
        <ManageBillingButton shopId={shopId} label="Already subscribed? Manage billing" />
      </div>

      <CompCodeForm shopId={shopId} />

      {checkoutPriceId && (
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm">
          <CheckoutForm shopId={shopId} priceId={checkoutPriceId} />
        </div>
      )}
    </section>
  );
}

function LifetimeAccessPanel({
  status,
  shopId,
}: {
  status: BillingStatus;
  shopId: string;
}) {
  const since = status.lifetimeSince;
  return (
    <section className="flex flex-col gap-6">
      <div className="bg-surface border-2 border-primary rounded-xl p-8 shadow-sm flex flex-col items-center text-center gap-3">
        <Icon name="workspace_premium" className="text-[40px] text-primary" />
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Lifetime access — complimentary
        </h2>
        <p className="text-on-surface-variant text-body-md max-w-xl">
          Every paid feature is unlocked for this shop, for any number of providers, with nothing to
          pay and no renewal date
          {since ? ` (active since ${new Date(since).toLocaleDateString()}).` : "."}
        </p>
        <div className="text-left">
          <FeatureList items={PAID_FEATURES} />
        </div>
      </div>
      {status.status && (
        <div className="flex flex-col gap-2">
          <p className="text-label-md text-on-surface-variant text-center">
            You still have a paid subscription on file. Cancel it so you're not charged — your access
            stays either way.
          </p>
          <SubscriptionStatusCard shopId={shopId} status={status} />
        </div>
      )}
    </section>
  );
}

export function CompCodeForm({ shopId }: { shopId: string }) {
  const [code, setCode] = useState("");
  const queryClient = useQueryClient();

  const redeem = useMutation({
    mutationFn: async () => {
      const result = await redeemCompCode({ data: { shopId, code: code.trim() } });
      if ("error" in result) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Lifetime access unlocked.");
      setCode("");
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="flex flex-col sm:flex-row items-center justify-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) redeem.mutate();
      }}
    >
      <label htmlFor="comp-code" className="text-label-md text-on-surface-variant">
        Have a comp code?
      </label>
      <input
        id="comp-code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="FOUNDER-XXXXXX"
        className="bg-surface border border-border-subtle rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none uppercase tracking-wide"
      />
      <Button type="submit" variant="outline" disabled={redeem.isPending || !code.trim()}>
        {redeem.isPending ? "Checking…" : "Redeem"}
      </Button>
    </form>
  );
}

function CycleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-label-md border transition-colors ${
        active
          ? "bg-primary text-on-primary border-primary"
          : "border-border-subtle text-on-surface-variant hover:text-on-surface"
      }`}
    >
      {children}
    </button>
  );
}

function FeatureList({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-body-md text-on-surface-variant">
          <Icon name="check" className="text-[18px] text-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CheckoutForm({
  shopId,
  priceId,
}: {
  shopId: string;
  priceId: AnalyticsPriceId;
}) {
  const fetchClientSecret = useCallback(async () => {
    const result = await createCheckoutSession({
      data: {
        shopId,
        environment: getStripeEnvironment(),
        priceId,
        returnPath: "/owner/feedback?billing=complete",
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Checkout could not be started.");
    return result.clientSecret;
  }, [shopId, priceId]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <div id="checkout" key={priceId}>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

export function ManageBillingButton({
  shopId,
  label = "Manage billing",
}: {
  shopId: string;
  label?: string;
}) {
  const portal = useMutation({
    mutationFn: async () => {
      const result = await createPortalSession({
        data: {
          shopId,
          environment: getStripeEnvironment(),
          returnPath: "/owner/feedback",
        },
      });
      if ("error" in result) throw new Error(result.error);
      return result;
    },
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <button
      type="button"
      onClick={() => portal.mutate()}
      disabled={portal.isPending}
      className="text-label-md text-on-surface-variant hover:text-primary underline-offset-2 hover:underline disabled:opacity-50"
    >
      {portal.isPending ? "Opening…" : label}
    </button>
  );
}
