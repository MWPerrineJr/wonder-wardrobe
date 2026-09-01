import { createFileRoute } from "@tanstack/react-router";

import { handlePaymentsWebhook, type StripeEvent } from "@/lib/payments-webhook.server";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

async function verifyPaymentsEvent(request: Request, env: StripeEnv): Promise<StripeEvent> {
  const parsed = (await verifyWebhook(request, env)) as {
    id?: unknown;
    type?: unknown;
    created?: unknown;
    data?: { object?: Record<string, unknown> };
  };
  if (typeof parsed?.id !== "string" || typeof parsed.type !== "string" || typeof parsed.created !== "number") {
    throw new Error("Malformed Stripe event");
  }
  return {
    id: parsed.id,
    type: parsed.type,
    created: parsed.created,
    data: { object: parsed.data?.object ?? {} },
  };
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => handlePaymentsWebhook(request, verifyPaymentsEvent),
    },
  },
});
