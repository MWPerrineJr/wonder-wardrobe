// Server-only Stripe access. All calls are routed through the Lovable
// connector gateway, which holds the real Stripe secret key — the
// STRIPE_*_API_KEY values in this project are gateway connection ids.
import Stripe from "stripe";

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = "sandbox" | "live";

const GATEWAY_STRIPE_BASE = "https://connector-gateway.lovable.dev/stripe";

export function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox" ? getEnv("STRIPE_SANDBOX_API_KEY") : getEnv("STRIPE_LIVE_API_KEY");
}

const WEBHOOK_SECRET_KEYS: Record<StripeEnv, string> = {
  sandbox: "PAYMENTS_SANDBOX_WEBHOOK_SECRET",
  live: "PAYMENTS_LIVE_WEBHOOK_SECRET",
};

const CONNECTION_KEYS: Record<StripeEnv, string> = {
  sandbox: "STRIPE_SANDBOX_API_KEY",
  live: "STRIPE_LIVE_API_KEY",
};

/** Which credentials are missing for an environment (empty = fully configured). */
export function missingPaymentConfig(env: StripeEnv): string[] {
  return [CONNECTION_KEYS[env], WEBHOOK_SECRET_KEYS[env], "LOVABLE_API_KEY"].filter(
    (key) => !process.env[key],
  );
}

/**
 * The payment environment is declared, not inferred: set PAYMENTS_ENV=sandbox|live.
 * Without it we fall back to credential presence for backwards compatibility, but
 * either way the matching connection key and webhook secret must both exist — a
 * half-configured deployment fails loudly instead of quietly taking (or dropping)
 * real money.
 */
export function resolvePaymentEnv(): StripeEnv {
  const raw = process.env["PAYMENTS_ENV"]?.trim().toLowerCase();
  let env: StripeEnv;
  if (raw === "live" || raw === "sandbox") {
    env = raw;
  } else if (raw) {
    throw new Error('PAYMENTS_ENV must be either "sandbox" or "live"');
  } else {
    env = process.env["STRIPE_LIVE_API_KEY"] ? "live" : "sandbox";
  }
  const missing = missingPaymentConfig(env);
  if (missing.length) {
    throw new Error(`Payments are not fully configured for ${env}: missing ${missing.join(", ")}`);
  }
  return env;
}

export type PaymentEnvReport = {
  environment: StripeEnv;
  declared: boolean;
  configured: boolean;
  missing: string[];
  error: string | null;
};

/** Non-throwing view of payment configuration, for owner-facing diagnostics. */
export function describePaymentEnv(): PaymentEnvReport {
  const raw = process.env["PAYMENTS_ENV"]?.trim().toLowerCase();
  const declared = raw === "live" || raw === "sandbox";
  try {
    const environment = resolvePaymentEnv();
    return { environment, declared, configured: true, missing: [], error: null };
  } catch (error) {
    const environment: StripeEnv =
      raw === "live" ? "live" : raw === "sandbox" ? "sandbox" : process.env["STRIPE_LIVE_API_KEY"] ? "live" : "sandbox";
    return {
      environment,
      declared,
      configured: false,
      missing: missingPaymentConfig(environment),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv("LOVABLE_API_KEY");

  return new Stripe(connectionApiKey, {
    apiVersion: "2026-03-25.dahlia",
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      const stripeUrl = input instanceof Request ? input.url : input.toString();
      const gatewayUrl = stripeUrl.replace("https://api.stripe.com", GATEWAY_STRIPE_BASE);
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(
            new Headers(
              init?.headers ?? (input instanceof Request ? input.headers : undefined),
            ).entries(),
          ),
          "X-Connection-Api-Key": connectionApiKey,
          "Lovable-API-Key": lovableApiKey,
        },
      });
    }),
  });
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const stripeError = error as {
      message?: string;
      type?: string;
      code?: string;
      decline_code?: string;
      param?: string;
      requestId?: string;
      raw?: {
        message?: string;
        type?: string;
        code?: string;
        decline_code?: string;
        param?: string;
        requestId?: string;
      };
    };

    const message = stripeError.raw?.message ?? stripeError.message;
    if (message) {
      const details = [
        stripeError.raw?.type ?? stripeError.type,
        stripeError.raw?.code ?? stripeError.code,
        stripeError.raw?.decline_code ?? stripeError.decline_code,
        stripeError.raw?.param ?? stripeError.param,
        stripeError.raw?.requestId ?? stripeError.requestId,
      ].filter(Boolean);
      return details.length ? `${message} (${details.join(", ")})` : message;
    }
  }

  return "Stripe request failed";
}

/** Verify a webhook signature (HMAC-SHA256 over "<timestamp>.<body>"). */
export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret =
    env === "sandbox"
      ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
      : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1" && value) v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");

  return JSON.parse(body);
}
