import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type JobStateRow = {
  job: string;
  status: string;
  pausedReason: string | null;
  lastRunAt: string | null;
  leaseUntil: string | null;
};

export type DiagnosticsReport = {
  environment: "sandbox" | "live";
  paymentsDeclared: boolean;
  paymentsConfigured: boolean;
  paymentsMissing: string[];
  appUrl: string | null;
  cronAppUrl: string | null;
  jobSecretOk: boolean;
  webhook: { completed24h: number; processing: number; failed: number };
  jobs: JobStateRow[];
  calendarOutboxPending: number;
  calendarOutboxFailed: number;
  surveyDeadLetters: number;
  holdsPending: number;
};

/**
 * Owner-facing deployment diagnostics. Only shop owners may read it, and it
 * reports configuration *names* and counts — never secret values.
 */
export const getDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticsReport> => {
    const { data: shops, error: shopError } = await context.supabase
      .from("shops")
      .select("id")
      .eq("owner_id", context.userId)
      .limit(1);
    if (shopError) throw new Error(shopError.message);
    if (!shops || shops.length === 0) {
      throw new Error("Only shop owners can view deployment diagnostics.");
    }

    const { describePaymentEnv } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payments = describePaymentEnv();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [
      completed,
      processing,
      failed,
      jobs,
      outboxPending,
      outboxFailed,
      deadLetters,
      holds,
      cronSetting,
    ] = await Promise.all([
      supabaseAdmin
        .from("payment_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "processed")
        .gte("created_at", since),
      supabaseAdmin
        .from("payment_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "processing"),
      supabaseAdmin
        .from("payment_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      supabaseAdmin
        .from("ai_job_state")
        .select("job_name, status, paused_reason, last_run_at, lease_until")
        .order("job_name"),
      supabaseAdmin
        .from("booking_calendar_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("booking_calendar_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      supabaseAdmin
        .from("survey_invites")
        .select("id", { count: "exact", head: true })
        .eq("delivery_terminal", true),
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .not("hold_expires_at", "is", null),
      supabaseAdmin.from("app_runtime_settings").select("value").eq("key", "app_url").maybeSingle(),
    ]);

    const secret = process.env["JOB_SECRET"] ?? "";
    const publishable =
      process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";

    return {
      environment: payments.environment,
      paymentsDeclared: payments.declared,
      paymentsConfigured: payments.configured,
      paymentsMissing: payments.missing,
      appUrl: process.env["APP_URL"] ?? null,
      cronAppUrl: cronSetting.data?.value ?? null,
      jobSecretOk: secret.length >= 32 && secret !== publishable,
      webhook: {
        completed24h: completed.count ?? 0,
        processing: processing.count ?? 0,
        failed: failed.count ?? 0,
      },
      jobs: (jobs.data ?? []).map((row) => ({
        job: row.job_name,
        status: row.status,
        pausedReason: row.paused_reason,
        lastRunAt: row.last_run_at,
        leaseUntil: row.lease_until,
      })),
      calendarOutboxPending: outboxPending.count ?? 0,
      calendarOutboxFailed: outboxFailed.count ?? 0,
      surveyDeadLetters: deadLetters.count ?? 0,
      holdsPending: holds.count ?? 0,
    };
  });
