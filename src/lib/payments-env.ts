/** Deployment payment mode. Live is never inferred from the presence of a live key. */

export type StripeEnv = "sandbox" | "live";

export class PaymentsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentsConfigError";
  }
}

export type PaymentsConfig = {
  env: StripeEnv;
  stripeKeyName: "STRIPE_SANDBOX_API_KEY" | "STRIPE_LIVE_API_KEY";
  webhookSecretName: "PAYMENTS_SANDBOX_WEBHOOK_SECRET" | "PAYMENTS_LIVE_WEBHOOK_SECRET";
};

export type ClientTokenKind = "test" | "live" | "missing" | "other";

export type PaymentsDiagnostic = {
  environment: StripeEnv | null;
  ok: boolean;
  issues: string[];
  stripeKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  lovableApiKeyConfigured: boolean;
  clientToken: ClientTokenKind;
  vitePaymentsEnv: string | null;
  webhookPath: string | null;
};

type EnvBag = Record<string, string | undefined>;

function present(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

function clientTokenKind(token: string | undefined): ClientTokenKind {
  const value = token?.trim();
  if (!value) return "missing";
  if (value.startsWith("pk_test_")) return "test";
  if (value.startsWith("pk_live_")) return "live";
  return "other";
}

export function parsePaymentsEnv(raw: string | undefined | null): StripeEnv {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "sandbox" || value === "live") return value;
  throw new PaymentsConfigError(
    "PAYMENTS_ENV must be set to sandbox or live. Live mode is not inferred from STRIPE_LIVE_API_KEY.",
  );
}

export function inspectPaymentsConfig(env: EnvBag = process.env): PaymentsDiagnostic {
  const issues: string[] = [];
  let environment: StripeEnv | null = null;

  try {
    environment = parsePaymentsEnv(env["PAYMENTS_ENV"]);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }

  const vitePaymentsEnv = env["VITE_PAYMENTS_ENV"]?.trim() || null;
  if (vitePaymentsEnv && vitePaymentsEnv !== "sandbox" && vitePaymentsEnv !== "live") {
    issues.push("VITE_PAYMENTS_ENV must be sandbox or live when set");
  } else if (environment && vitePaymentsEnv && vitePaymentsEnv !== environment) {
    issues.push(`VITE_PAYMENTS_ENV=${vitePaymentsEnv} does not match PAYMENTS_ENV=${environment}`);
  }

  const tokenKind = clientTokenKind(env["VITE_PAYMENTS_CLIENT_TOKEN"]);
  if (
    environment &&
    (tokenKind === "missing" || tokenKind === "other") &&
    vitePaymentsEnv !== environment
  ) {
    issues.push(`Set VITE_PAYMENTS_ENV=${environment} so the client matches PAYMENTS_ENV`);
  }
  if (environment === "sandbox" && tokenKind === "live") {
    issues.push("PAYMENTS_ENV=sandbox but VITE_PAYMENTS_CLIENT_TOKEN is a live publishable key");
  }
  if (environment === "live" && tokenKind === "test") {
    issues.push("PAYMENTS_ENV=live but VITE_PAYMENTS_CLIENT_TOKEN is a test publishable key");
  }

  const sandboxKey = present(env["STRIPE_SANDBOX_API_KEY"]);
  const liveKey = present(env["STRIPE_LIVE_API_KEY"]);
  const sandboxWhsec = present(env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"]);
  const liveWhsec = present(env["PAYMENTS_LIVE_WEBHOOK_SECRET"]);
  const lovable = present(env["LOVABLE_API_KEY"]);

  if (environment === "sandbox") {
    if (!sandboxKey) issues.push("PAYMENTS_ENV=sandbox requires STRIPE_SANDBOX_API_KEY");
    if (!sandboxWhsec) issues.push("PAYMENTS_ENV=sandbox requires PAYMENTS_SANDBOX_WEBHOOK_SECRET");
  }
  if (environment === "live") {
    if (!liveKey) issues.push("PAYMENTS_ENV=live requires STRIPE_LIVE_API_KEY");
    if (!liveWhsec) issues.push("PAYMENTS_ENV=live requires PAYMENTS_LIVE_WEBHOOK_SECRET");
  }
  if (environment && !lovable) issues.push("LOVABLE_API_KEY is not configured");

  return {
    environment,
    ok: issues.length === 0 && environment !== null,
    issues,
    stripeKeyConfigured: environment === "live" ? liveKey : sandboxKey,
    webhookSecretConfigured: environment === "live" ? liveWhsec : sandboxWhsec,
    lovableApiKeyConfigured: lovable,
    clientToken: tokenKind,
    vitePaymentsEnv,
    webhookPath: environment ? `/api/public/payments/webhook?env=${environment}` : null,
  };
}

export function assertPaymentsConfig(env: EnvBag = process.env): PaymentsConfig {
  const diagnostic = inspectPaymentsConfig(env);
  if (!diagnostic.ok || !diagnostic.environment) {
    throw new PaymentsConfigError(diagnostic.issues[0] ?? "Payments are not configured");
  }
  return {
    env: diagnostic.environment,
    stripeKeyName:
      diagnostic.environment === "sandbox" ? "STRIPE_SANDBOX_API_KEY" : "STRIPE_LIVE_API_KEY",
    webhookSecretName:
      diagnostic.environment === "sandbox"
        ? "PAYMENTS_SANDBOX_WEBHOOK_SECRET"
        : "PAYMENTS_LIVE_WEBHOOK_SECRET",
  };
}

export function configuredPaymentsEnv(env: EnvBag = process.env): StripeEnv {
  return assertPaymentsConfig(env).env;
}

export function requirePaymentsEnv(requested: StripeEnv, env: EnvBag = process.env): StripeEnv {
  const configured = configuredPaymentsEnv(env);
  if (requested !== configured) {
    throw new PaymentsConfigError(`This deployment charges in ${configured} mode`);
  }
  return configured;
}

let loggedPaymentsConfig = false;

/** Structured log once per process. Never includes secrets. */
export function logPaymentsConfigOnce(env: EnvBag = process.env): void {
  if (loggedPaymentsConfig) return;
  loggedPaymentsConfig = true;
  const diagnostic = inspectPaymentsConfig(env);
  const payload = {
    component: "payments",
    ts: new Date().toISOString(),
    ok: diagnostic.ok,
    environment: diagnostic.environment,
    issues: diagnostic.issues,
  };
  if (diagnostic.ok) console.log(JSON.stringify(payload));
  else console.error(JSON.stringify(payload));
}
