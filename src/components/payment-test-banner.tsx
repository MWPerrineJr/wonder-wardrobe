import { getStripeEnvironment } from "@/lib/stripe";

export function PaymentTestModeBanner() {
  try {
    if (getStripeEnvironment() !== "sandbox") return null;
  } catch {
    return (
      <div className="w-full bg-destructive/10 border-b border-destructive/30 px-4 py-2 text-center text-label-sm text-destructive">
        Checkout is not configured for this build yet. Set PAYMENTS_ENV and VITE_PAYMENTS_ENV to
        sandbox or live.
      </div>
    );
  }
  return (
    <div className="w-full bg-primary/10 border-b border-primary/30 px-4 py-2 text-center text-label-sm text-on-surface-variant">
      Payments made in the preview are test payments — no money changes hands.{" "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-medium"
      >
        Read more
      </a>
    </div>
  );
}
