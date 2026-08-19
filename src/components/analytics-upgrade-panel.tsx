import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createCheckoutSession, createPortalSession, getBillingStatus } from "@/lib/billing.functions";
import {
  PLAN_TIERS,
  TRIAL_DAYS,
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

      {checkoutPriceId && (
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm">
          <CheckoutForm shopId={shopId} priceId={checkoutPriceId} />
        </div>
      )}
    </section>
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
        returnUrl: `${window.location.origin}/owner/feedback?billing=complete`,
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
          returnUrl: `${window.location.origin}/owner/feedback`,
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
