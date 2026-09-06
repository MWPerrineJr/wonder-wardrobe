import { TRIAL_DAYS } from "./trial.ts";

export type TrialEvent =
  | "signup_trial_started"
  | "stripe_trial_started"
  | "converted_paid"
  | "past_due"
  | "canceled"
  | "lifetime"
  | "backfilled";

export type TrialSource = "none" | "signup" | "stripe";

export const TRIAL_EVENT_LABEL: Record<TrialEvent, string> = {
  signup_trial_started: "Signup trial started",
  stripe_trial_started: "Checkout trial started",
  converted_paid: "Converted to paid",
  past_due: "Payment past due",
  canceled: "Canceled",
  lifetime: "Lifetime access granted",
  backfilled: "Recorded from existing signup",
};

export const TRIAL_SOURCE_LABEL: Record<TrialSource, string> = {
  none: "—",
  signup: "Signup",
  stripe: "Paid",
};

/** End of the recorded signup-side trial window (tracking only; access still needs checkout). */
export function signupTrialEndsAt(signedUpAt: string | Date): string {
  const start = signedUpAt instanceof Date ? signedUpAt : new Date(signedUpAt);
  return new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Stripe rejects a trial that ends less than 48 hours from now. */
const MIN_TRIAL_LEAD_MS = 48 * 60 * 60 * 1000;

export type StripeTrialAnchor =
  | { trialEndUnix: number; daysLeft: number }
  | { trialEndUnix: null; reason: "elapsed" };

/**
 * Anchor the paid trial to the day the shop signed up, so the 90-day promotion
 * cannot be extended by delaying checkout. Returns no trial when the window is
 * already gone (or ends within Stripe's 48-hour minimum).
 */
export function stripeTrialEndFromSignup(
  signedUpAt: string | Date | null | undefined,
  now: Date = new Date(),
): StripeTrialAnchor {
  if (!signedUpAt) return { trialEndUnix: null, reason: "elapsed" };
  const endMs = new Date(signupTrialEndsAt(signedUpAt)).getTime();
  if (!Number.isFinite(endMs)) return { trialEndUnix: null, reason: "elapsed" };
  const remaining = endMs - now.getTime();
  if (remaining < MIN_TRIAL_LEAD_MS) return { trialEndUnix: null, reason: "elapsed" };
  return {
    trialEndUnix: Math.floor(endMs / 1000),
    daysLeft: Math.ceil(remaining / (24 * 60 * 60 * 1000)),
  };
}

/** Map a billing plan state onto the trial-history event it should record. */
export function trialEventForPlanState(planState: string): TrialEvent | null {
  switch (planState) {
    case "trialing":
      return "stripe_trial_started";
    case "active":
      return "converted_paid";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "lifetime":
      return "lifetime";
    default:
      return null;
  }
}

/**
 * Only record an event when the plan state actually changed — webhooks replay
 * and Stripe resends the same status many times per subscription.
 */
export function shouldRecordTrialEvent(
  previousPlanState: string | null | undefined,
  nextPlanState: string,
): boolean {
  if (trialEventForPlanState(nextPlanState) === null) return false;
  return previousPlanState !== nextPlanState;
}
