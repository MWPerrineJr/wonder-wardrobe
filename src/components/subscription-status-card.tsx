import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ManageBillingButton } from "@/components/analytics-upgrade-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cancelSubscription, type BillingStatus } from "@/lib/billing.functions";
import { PLAN_TIERS, getStripeEnvironment, tierForPriceId } from "@/lib/stripe";

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "long" }) : null;

const STATUS_COPY: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment failed — retrying",
  canceled: "Canceled",
  unpaid: "Unpaid",
  paused: "Paused",
};

/** Subscription summary with an in-app cancel (and resume) control. */
export function SubscriptionStatusCard({
  shopId,
  status,
}: {
  shopId: string;
  status: BillingStatus;
}) {
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();

  const mutate = useMutation({
    mutationFn: async (resume: boolean) => {
      const result = await cancelSubscription({
        data: { shopId, environment: getStripeEnvironment(), resume },
      });
      if ("error" in result) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      toast.success(
        result.cancelAtPeriodEnd
          ? "Subscription canceled. Your access stays until the end of the paid period."
          : "Subscription resumed. Billing continues as normal.",
      );
      void queryClient.invalidateQueries({ queryKey: ["owner", "billing", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancellable = ["trialing", "active", "past_due"].includes(status.status ?? "");
  if (!status.status || (!cancellable && !status.cancelAtPeriodEnd)) return null;

  const tierId = tierForPriceId(status.priceId);
  const tier = PLAN_TIERS.find((t) => t.id === tierId);
  const yearly = status.priceId?.endsWith("_yearly");
  const endsOn = formatDate(status.currentPeriodEnd);

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label-md text-on-surface-variant uppercase tracking-wide">
            Your subscription
          </p>
          <p className="font-headline-md text-headline-md text-on-surface">
            Analytics {tier?.name ?? "plan"}
            {tier ? ` — ${yearly ? tier.yearlyLabel : tier.monthlyLabel}` : ""}
          </p>
          <p className="text-label-sm text-on-surface-variant">
            {STATUS_COPY[status.status] ?? status.status}
            {status.cancelAtPeriodEnd && endsOn
              ? ` · Cancels on ${endsOn}`
              : endsOn
                ? ` · Renews on ${endsOn}`
                : ""}
          </p>
        </div>
        <span
          className={`text-label-sm rounded-full px-3 py-1 ${
            status.cancelAtPeriodEnd
              ? "bg-on-surface/10 text-on-surface-variant"
              : "bg-primary/10 text-primary"
          }`}
        >
          {status.cancelAtPeriodEnd ? "Ending" : "Included: surveys, AI feedback, analytics"}
        </span>
      </div>

      {status.status === "past_due" && (
        <p className="text-body-md text-on-surface-variant">
          Your last payment didn't go through. Update your card under Manage billing — access stays
          on while we retry.
        </p>
      )}

      {status.cancelAtPeriodEnd ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-body-md text-on-surface-variant flex-1">
            Surveys, Feedback Intelligence and analytics stay available
            {endsOn ? ` until ${endsOn}` : " until the end of this period"}. Your shop page,
            services, hours and bookings are never affected.
          </p>
          <Button
            className="font-bold"
            disabled={mutate.isPending}
            onClick={() => mutate.mutate(true)}
          >
            {mutate.isPending ? "Working…" : "Resume subscription"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={() => setConfirming(true)} disabled={mutate.isPending}>
            Cancel subscription
          </Button>
          <ManageBillingButton shopId={shopId} label="Manage billing, card and invoices" />
        </div>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your Analytics subscription?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2 text-left">
                <span>
                  You won't be charged again. Surveys, Feedback Intelligence and business analytics
                  stay available {endsOn ? `until ${endsOn}` : "until the end of the paid period"} —
                  nothing is cut off mid-cycle.
                </span>
                <span>
                  Your public shop page, booking link, services, hours and existing bookings keep
                  working for free. You can resubscribe or resume any time.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my plan</AlertDialogCancel>
            <AlertDialogAction onClick={() => mutate.mutate(false)}>
              Cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
