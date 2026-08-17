import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createCheckoutSession, createPortalSession } from "@/lib/billing.functions";
import { ANALYTICS_PLAN, getStripe, getStripeEnvironment } from "@/lib/stripe";

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
  const [checkoutFor, setCheckoutFor] = useState<BillingCycle | null>(null);

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
          {ANALYTICS_PLAN.trialDays}-day free trial.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-gutter">
        <div className="bg-surface border border-border-subtle rounded-xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-label-md text-on-surface-variant uppercase tracking-wide">Free</p>
            <p className="font-headline-md text-headline-md text-on-surface">$0 / month</p>
          </div>
          <FeatureList items={FREE_FEATURES} />
          <p className="text-label-sm text-on-surface-variant mt-auto">Your current plan.</p>
        </div>

        <div className="bg-surface border-2 border-primary rounded-xl p-6 flex flex-col gap-4 shadow-sm">
          <div>
            <p className="text-label-md text-primary uppercase tracking-wide">Analytics</p>
            <p className="font-headline-md text-headline-md text-on-surface">
              {cycle === "monthly" ? ANALYTICS_PLAN.monthlyLabel : ANALYTICS_PLAN.yearlyLabel}
            </p>
            <p className="text-label-sm text-on-surface-variant">
              {cycle === "monthly"
                ? "Billed monthly, cancel anytime."
                : "Billed yearly — save $440 versus monthly."}
            </p>
          </div>

          <div className="flex gap-2">
            <CycleButton active={cycle === "monthly"} onClick={() => setCycle("monthly")}>
              Monthly
            </CycleButton>
            <CycleButton active={cycle === "yearly"} onClick={() => setCycle("yearly")}>
              Annual
            </CycleButton>
          </div>

          <FeatureList items={PAID_FEATURES} />

          <Button className="font-bold mt-auto" onClick={() => setCheckoutFor(cycle)}>
            Start {ANALYTICS_PLAN.trialDays}-day free trial
          </Button>
          <ManageBillingButton shopId={shopId} label="Already subscribed? Manage billing" />
        </div>
      </div>

      {checkoutFor && (
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm">
          <CheckoutForm shopId={shopId} cycle={checkoutFor} />
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

export function CheckoutForm({ shopId, cycle }: { shopId: string; cycle: BillingCycle }) {
  const fetchClientSecret = useCallback(async () => {
    const result = await createCheckoutSession({
      data: {
        shopId,
        environment: getStripeEnvironment(),
        priceId: cycle === "monthly" ? "analytics_monthly" : "analytics_yearly",
        returnUrl: `${window.location.origin}/owner/feedback?billing=complete`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Checkout could not be started.");
    return result.clientSecret;
  }, [shopId, cycle]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <div id="checkout">
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
