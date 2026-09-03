import { loadStripe, type Stripe } from "@stripe/stripe-js";

import { TRIAL_DAYS } from "@/lib/trial";

type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
const vitePaymentsEnv = import.meta.env.VITE_PAYMENTS_ENV as string | undefined;

function paymentsEnvironment(): StripeEnv {
  if (vitePaymentsEnv === "sandbox" || vitePaymentsEnv === "live") {
    return vitePaymentsEnv;
  }
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error(
    "Payments are not configured for this build. Set VITE_PAYMENTS_ENV=sandbox|live to match PAYMENTS_ENV.",
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}

export { TRIAL_DAYS };

export type PlanTierId = "solo" | "team" | "enterprise";
export type AnalyticsPriceId =
  | "analytics_monthly"
  | "analytics_yearly"
  | "analytics_team_monthly"
  | "analytics_team_yearly"
  | "analytics_enterprise_monthly"
  | "analytics_enterprise_yearly";

export type PlanTier = {
  id: PlanTierId;
  name: string;
  providers: string;
  monthlyPriceId: AnalyticsPriceId;
  yearlyPriceId: AnalyticsPriceId;
  monthlyLabel: string;
  yearlyLabel: string;
  yearlySavings: string;
};

export const PLAN_TIERS: readonly PlanTier[] = [
  {
    id: "solo",
    name: "Solo",
    providers: "1 provider",
    monthlyPriceId: "analytics_monthly",
    yearlyPriceId: "analytics_yearly",
    monthlyLabel: "$120 / month",
    yearlyLabel: "$1,000 / year",
    yearlySavings: "Save $440 a year",
  },
  {
    id: "team",
    name: "Team",
    providers: "2 providers",
    monthlyPriceId: "analytics_team_monthly",
    yearlyPriceId: "analytics_team_yearly",
    monthlyLabel: "$200 / month",
    yearlyLabel: "$2,000 / year",
    yearlySavings: "Save $400 a year",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    providers: "3 or more providers",
    monthlyPriceId: "analytics_enterprise_monthly",
    yearlyPriceId: "analytics_enterprise_yearly",
    monthlyLabel: "$250 / month",
    yearlyLabel: "$2,500 / year",
    yearlySavings: "Save $500 a year",
  },
] as const;

export function tierForProviderCount(count: number): PlanTierId {
  if (count > 2) return "enterprise";
  if (count === 2) return "team";
  return "solo";
}

export function tierForPriceId(priceId: string | null): PlanTierId | null {
  const tier = PLAN_TIERS.find((t) => t.monthlyPriceId === priceId || t.yearlyPriceId === priceId);
  return tier?.id ?? null;
}

/** Legacy single-plan constant kept for existing copy. */
export const ANALYTICS_PLAN = {
  monthlyPriceId: "analytics_monthly",
  yearlyPriceId: "analytics_yearly",
  monthlyLabel: "$120 / month",
  yearlyLabel: "$1,000 / year",
  trialDays: TRIAL_DAYS,
} as const;
