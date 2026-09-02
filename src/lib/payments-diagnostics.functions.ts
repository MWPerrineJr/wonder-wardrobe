import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { inspectPaymentsConfig, type PaymentsDiagnostic } from "@/lib/payments-env";

export type JobOpsRow = {
  jobName: string;
  status: string;
  pausedReason: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
};

export type OpsDiagnosticsView = PaymentsDiagnostic & {
  appUrlConfigured: boolean;
  jobs: JobOpsRow[];
  webhook: {
    processing: number;
    failed: number;
    completedLastDay: number;
  };
  calendarOutboxPending: number;
};

export const getPaymentsDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OpsDiagnosticsView> => {
    const diagnostic = inspectPaymentsConfig();
    const base: OpsDiagnosticsView = {
      ...diagnostic,
      appUrlConfigured: Boolean(process.env["APP_URL"]?.trim()),
      jobs: [],
      webhook: { processing: 0, failed: 0, completedLastDay: 0 },
      calendarOutboxPending: 0,
    };

    const { data: roles, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr || !roles?.some((row) => row.role === "owner")) {
      return base;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [jobsRes, processingRes, failedRes, completedRes, outboxRes] = await Promise.all([
      supabaseAdmin
        .from("ai_job_state")
        .select("job_name, status, paused_reason, last_run_at, last_error, consecutive_failures")
        .order("job_name"),
      supabaseAdmin
        .from("stripe_webhook_events")
        .select("stripe_event_id", { count: "exact", head: true })
        .eq("status", "processing"),
      supabaseAdmin
        .from("stripe_webhook_events")
        .select("stripe_event_id", { count: "exact", head: true })
        .eq("status", "failed"),
      supabaseAdmin
        .from("stripe_webhook_events")
        .select("stripe_event_id", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("updated_at", dayAgo),
      supabaseAdmin
        .from("booking_calendar_outbox")
        .select("id", { count: "exact", head: true })
        .is("processed_at", null),
    ]);

    return {
      ...base,
      jobs: (jobsRes.data ?? []).map((row) => ({
        jobName: row.job_name,
        status: row.status,
        pausedReason: row.paused_reason,
        lastRunAt: row.last_run_at,
        lastError: row.last_error,
        consecutiveFailures: row.consecutive_failures,
      })),
      webhook: {
        processing: processingRes.count ?? 0,
        failed: failedRes.count ?? 0,
        completedLastDay: completedRes.count ?? 0,
      },
      calendarOutboxPending: outboxRes.count ?? 0,
    };
  });
