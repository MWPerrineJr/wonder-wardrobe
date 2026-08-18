import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { updateShop } from "@/lib/owner.functions";
import {
  createPayoutLoginLink,
  getPayoutAccount,
  refreshPayoutAccount,
  startPayoutOnboarding,
} from "@/lib/payouts.functions";
import { getStripeEnvironment } from "@/lib/stripe";

const MODES = [
  { value: "off", label: "No prepayment", hint: "Clients pay in person." },
  { value: "deposit", label: "Deposit at booking", hint: "Hold the slot with a partial payment." },
  { value: "full", label: "Full price upfront", hint: "Clients pay the whole service when booking." },
] as const;

type Mode = (typeof MODES)[number]["value"];

export function PaymentsPanel({
  shopId,
  prepayMode,
  depositPercent,
}: {
  shopId: string;
  prepayMode: Mode;
  depositPercent: number;
}) {
  const qc = useQueryClient();
  const environment = getStripeEnvironment();
  const [mode, setMode] = useState<Mode>(prepayMode);
  const [percent, setPercent] = useState(depositPercent);

  useEffect(() => {
    setMode(prepayMode);
    setPercent(depositPercent);
  }, [shopId, prepayMode, depositPercent]);

  const accountQuery = useQuery({
    queryKey: ["payout-account", shopId, environment],
    queryFn: () => getPayoutAccount({ data: { shopId, environment } }),
  });

  // Returning from Stripe onboarding — pull the live capability flags once.
  const refresh = useMutation({
    mutationFn: () => refreshPayoutAccount({ data: { shopId, environment } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payout-account", shopId] }),
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payouts") === "return") refresh.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const onboarding = useMutation({
    mutationFn: () =>
      startPayoutOnboarding({
        data: {
          shopId,
          environment,
          returnUrl: `${window.location.origin}/owner?payouts=return`,
        },
      }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.location.href = res.url;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start onboarding"),
  });

  const dashboard = useMutation({
    mutationFn: () => createPayoutLoginLink({ data: { shopId, environment } }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.url, "_blank", "noopener");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not open payouts"),
  });

  const save = useMutation({
    mutationFn: () =>
      updateShop({ data: { shopId, patch: { prepay_mode: mode, deposit_percent: percent } } }),
    onSuccess: () => {
      toast.success("Prepayment settings saved.");
      qc.invalidateQueries({ queryKey: ["my-shops"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save settings"),
  });

  const account = accountQuery.data;
  const ready = account?.chargesEnabled ?? false;

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-surface border border-border-subtle rounded-xl p-6 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="font-headline-md text-headline-md text-on-surface">Payout account</h2>
          <p className="text-on-surface-variant text-body-md">
            Connect your own payment account so client prepayments land directly in your bank —
            The Standing Chair never holds your money.
          </p>
        </div>

        {accountQuery.isPending ? (
          <p className="text-on-surface-variant text-body-md">Checking your payout account…</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-label-sm border ${
                ready
                  ? "border-primary text-primary"
                  : account?.connected
                    ? "border-border-subtle text-on-surface-variant"
                    : "border-border-subtle text-on-surface-variant"
              }`}
            >
              {ready
                ? "Ready to accept payments"
                : account?.connected
                  ? "Setup incomplete"
                  : "Not connected"}
            </span>
            <button
              type="button"
              onClick={() => onboarding.mutate()}
              disabled={onboarding.isPending}
              className="bg-primary text-on-primary rounded-lg px-4 py-2 font-label-md font-bold disabled:opacity-50"
            >
              {onboarding.isPending
                ? "Opening…"
                : account?.connected
                  ? "Continue setup"
                  : "Connect payouts"}
            </button>
            {account?.connected && (
              <>
                <button
                  type="button"
                  onClick={() => dashboard.mutate()}
                  disabled={dashboard.isPending}
                  className="bg-surface border border-border-subtle text-on-surface rounded-lg px-4 py-2 font-label-md disabled:opacity-50"
                >
                  View payouts
                </button>
                <button
                  type="button"
                  onClick={() => refresh.mutate()}
                  disabled={refresh.isPending}
                  className="text-on-surface-variant text-label-md underline disabled:opacity-50"
                >
                  {refresh.isPending ? "Refreshing…" : "Refresh status"}
                </button>
              </>
            )}
          </div>
        )}
        {environment === "sandbox" && (
          <p className="text-on-surface-variant font-label-sm text-label-sm">
            Test mode: use Stripe's test onboarding details. Switch to live payments when you're
            ready to publish.
          </p>
        )}
      </section>

      <section className="bg-surface border border-border-subtle rounded-xl p-6 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="font-headline-md text-headline-md text-on-surface">Prepayment at booking</h2>
          <p className="text-on-surface-variant text-body-md">
            Choose what clients pay when they book. Prepayment only shows on your booking page once
            your payout account is ready.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                mode === m.value ? "border-primary" : "border-border-subtle hover:border-primary/50"
              }`}
            >
              <input
                type="radio"
                name="prepay-mode"
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="mt-1 accent-[color:var(--color-primary)]"
              />
              <span className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface">{m.label}</span>
                <span className="text-on-surface-variant text-body-md">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {mode === "deposit" && (
          <div className="flex flex-col gap-1 max-w-xs">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Deposit percentage
            </label>
            <input
              type="number"
              min={5}
              max={100}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
              className="bg-surface border border-border-subtle rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
        )}

        {mode !== "off" && !ready && (
          <p className="text-error text-body-md">
            Connect and finish your payout account above, or clients will keep booking without
            paying.
          </p>
        )}

        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || (mode === "deposit" && (percent < 5 || percent > 100))}
          className="self-start bg-primary text-on-primary rounded-lg px-5 py-2.5 font-label-md font-bold disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save prepayment settings"}
        </button>
      </section>
    </div>
  );
}