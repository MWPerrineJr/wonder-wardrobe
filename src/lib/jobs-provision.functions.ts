import { createServerFn } from "@tanstack/react-start";

/**
 * One-off setup helper. Copies the deployment's JOB_SECRET into the database
 * vault (as `job_secret`) and records APP_URL in app_runtime_settings, so the
 * pg_cron scheduler can authenticate to /api/public/jobs/* without ever
 * embedding a credential in SQL. Returns booleans only — never the values.
 */
export const provisionJobScheduler = createServerFn({ method: "POST" }).handler(async () => {
  const secret = process.env["JOB_SECRET"] ?? "";
  const appUrl = process.env["APP_URL"] ?? "";

  if (secret.length < 32) return { ok: false as const, reason: "job_secret_missing" };
  if (!appUrl.startsWith("https://")) return { ok: false as const, reason: "app_url_missing" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("provision_job_scheduler", {
    _secret: secret,
    _app_url: appUrl,
  });

  if (error) return { ok: false as const, reason: error.message };
  return { ok: data === "ok", secretLength: secret.length, appUrlHost: new URL(appUrl).host };
});
