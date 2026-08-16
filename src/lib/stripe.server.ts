// Minimal Stripe REST client + webhook signature verification.
//
// Deliberately dependency-free: the official `stripe` package assumes a Node
// runtime and would add lockfile churn; the three API calls billing needs are
// simple form-encoded POSTs, and signature verification is one HMAC. Web
// Crypto keeps this portable to the Cloudflare/Nitro deploy target.
//
// Server-only: import from server handlers / *.server modules, never from
// client code.

const STRIPE_API = "https://api.stripe.com/v1";

function stripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  return key;
}

/** Flatten nested params into Stripe's form encoding, e.g. subscription_data[metadata][shop_id]. */
function encodeForm(params: Record<string, unknown>, prefix = ""): string[] {
  const pairs: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object" && item !== null) {
          pairs.push(...encodeForm(item as Record<string, unknown>, `${key}[${i}]`));
        } else {
          pairs.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof v === "object") {
      pairs.push(...encodeForm(v as Record<string, unknown>, key));
    } else {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return pairs;
}

export async function stripeRequest<T = Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const body = params ? encodeForm(params).join("&") : undefined;
  const url = method === "GET" && body ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body : undefined,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Stripe ${method} ${path} failed (${res.status})`);
  }
  return json;
}

/**
 * Verify a Stripe webhook signature (v1 scheme: HMAC-SHA256 of
 * "<timestamp>.<raw payload>"). Returns the parsed event or null if invalid.
 */
export async function verifyStripeEvent(
  rawBody: string,
  signatureHeader: string | null,
  toleranceSeconds = 300,
): Promise<Record<string, unknown> | null> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return null;

  const parts = new Map<string, string[]>();
  for (const kv of signatureHeader.split(",")) {
    const [k, v] = kv.split("=", 2);
    if (!k || !v) continue;
    const list = parts.get(k.trim()) ?? [];
    list.push(v.trim());
    parts.set(k.trim(), list);
  }
  const timestamp = parts.get("t")?.[0];
  const signatures = parts.get("v1") ?? [];
  if (!timestamp || signatures.length === 0) return null;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return null;

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(`${timestamp}.${rawBody}`),
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison across all provided v1 signatures.
  let valid = false;
  for (const sig of signatures) {
    if (sig.length !== expected.length) continue;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff === 0) valid = true;
  }
  if (!valid) return null;

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end: boolean;
  metadata?: Record<string, string>;
  items: { data: Array<{ price: { id: string }; current_period_end?: number }> };
  /** Present on older API versions; newer versions carry it on items. */
  current_period_end?: number;
};

export function subscriptionPeriodEnd(sub: StripeSubscription): string | null {
  const unix = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return unix ? new Date(unix * 1000).toISOString() : null;
}
