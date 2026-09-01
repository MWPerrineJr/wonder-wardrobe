import { createFileRoute } from "@tanstack/react-router";

/**
 * Readiness probe. 200 only when the deployment can actually serve traffic:
 * Supabase reachable, payments fully configured for the declared environment,
 * and the scheduled-job secret usable. On failure it returns 503 with an
 * `issues` array of *names only* — never secret values.
 */

type Issue = { check: string; detail: string };

async function supabaseReachable(): Promise<Issue | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url) return { check: "SUPABASE_URL", detail: "not set" };
  if (!key) return { check: "SUPABASE_PUBLISHABLE_KEY", detail: "not set" };
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: key },
    });
    if (!res.ok) return { check: "supabase", detail: `auth health returned ${res.status}` };
    return null;
  } catch {
    return { check: "supabase", detail: "auth health request failed" };
  }
}

function jobSecretIssue(): Issue | null {
  const secret = process.env["JOB_SECRET"] ?? "";
  const publishable =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
  if (!secret) return { check: "JOB_SECRET", detail: "not set" };
  if (secret.length < 32) return { check: "JOB_SECRET", detail: "shorter than 32 characters" };
  if (publishable && secret === publishable) {
    return { check: "JOB_SECRET", detail: "must not equal the publishable key" };
  }
  return null;
}

function appUrlIssue(): Issue | null {
  const value = process.env["APP_URL"];
  if (!value) return { check: "APP_URL", detail: "not set" };
  if (!/^https:\/\/[^/]+$/.test(value)) {
    return { check: "APP_URL", detail: "must be an https origin with no trailing slash" };
  }
  return null;
}

export const Route = createFileRoute("/api/public/ready")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const issues: Issue[] = [];

        const { describePaymentEnv } = await import("@/lib/stripe.server");
        const payments = describePaymentEnv();
        if (!payments.configured) {
          for (const name of payments.missing) {
            issues.push({ check: name, detail: `required for ${payments.environment} payments` });
          }
          if (payments.missing.length === 0 && payments.error) {
            issues.push({ check: "PAYMENTS_ENV", detail: payments.error });
          }
        }
        if (!payments.declared) {
          issues.push({ check: "PAYMENTS_ENV", detail: "not declared (must be sandbox or live)" });
        }

        for (const issue of [appUrlIssue(), jobSecretIssue(), await supabaseReachable()]) {
          if (issue) issues.push(issue);
        }

        const okay = issues.length === 0;
        return Response.json(
          {
            status: okay ? "ok" : "degraded",
            payments: payments.configured && payments.declared ? "ok" : "not_ready",
            environment: payments.environment,
            issues,
            time: new Date().toISOString(),
          },
          {
            status: okay ? 200 : 503,
            headers: {
              "cache-control": "no-store",
              "x-request-id": request.headers.get("x-request-id") ?? crypto.randomUUID(),
            },
          },
        );
      },
    },
  },
});
