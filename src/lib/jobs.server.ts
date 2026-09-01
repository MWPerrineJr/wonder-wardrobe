// Shared plumbing for the scheduled feedback jobs: caller auth, single-flight
// leases and the pause/probe circuit breaker. Service-role only — never
// imported from client-reachable modules.

import { authorizeJobCall, jobAuthResponse } from "@/lib/jobs.auth";

export type JobName =
  | "send-surveys"
  | "enrich-feedback"
  | "build-reports"
  | "booking-maintenance";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type JobLease =
  | { ok: true; paused: false; probeOnly: false }
  | { ok: true; paused: true; probeOnly: true; reason: string | null }
  | { ok: false; skipped: "locked" };

const LEASE_MINUTES = 10;

type JobLog = Record<string, string | number | boolean | null | undefined>;

/** Structured logs only. Never include Authorization, JOB_SECRET, or API keys. */
export function logJobEvent(fields: JobLog) {
  console.log(JSON.stringify({ component: "jobs", ts: new Date().toISOString(), ...fields }));
}

export async function runScheduledJob(
  request: Request,
  job: JobName,
  handler: (ctx: {
    request: Request;
    admin: Admin;
    lease: Extract<JobLease, { ok: true }>;
  }) => Promise<Response>,
): Promise<Response> {
  const started = Date.now();
  const auth = authorizeJobCall(request);
  if (!auth.ok) {
    logJobEvent({ event: "job.auth", job, ok: false, reason: auth.reason, status: auth.status });
    return jobAuthResponse(auth);
  }
  logJobEvent({ event: "job.auth", job, ok: true });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const lease = await acquireLease(supabaseAdmin, job);
  if (!lease.ok) {
    logJobEvent({ event: "job.skipped", job, skipped: lease.skipped, ms: Date.now() - started });
    return Response.json({ skipped: lease.skipped });
  }

  try {
    const response = await handler({ request, admin: supabaseAdmin, lease });
    logJobEvent({
      event: "job.complete",
      job,
      status: response.status,
      paused: lease.paused,
      ms: Date.now() - started,
    });
    return response;
  } catch (error) {
    logJobEvent({
      event: "job.error",
      job,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : "error",
    });
    throw error;
  } finally {
    await releaseLease(supabaseAdmin, job);
  }
}

/**
 * Acquire the job lease. A second concurrent run sees a live lease and exits.
 * A job paused by a 402/403 is allowed exactly one probe item per run so it can
 * detect out-of-band recovery.
 */
export async function acquireLease(admin: Admin, job: JobName): Promise<JobLease> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString();

  const { data: state } = await admin
    .from("ai_job_state")
    .select("status, paused_reason, lease_until")
    .eq("job_name", job)
    .maybeSingle();

  const leaseLive = state?.lease_until ? new Date(state.lease_until) > now : false;
  if (leaseLive) return { ok: false, skipped: "locked" };

  const { data: claimed } = await admin
    .from("ai_job_state")
    .update({ lease_until: leaseUntil, last_run_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("job_name", job)
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .select("status, paused_reason")
    .maybeSingle();

  if (!claimed) return { ok: false, skipped: "locked" };
  if (claimed.status === "paused")
    return { ok: true, paused: true, probeOnly: true, reason: claimed.paused_reason ?? null };
  return { ok: true, paused: false, probeOnly: false };
}

export async function releaseLease(admin: Admin, job: JobName) {
  await admin
    .from("ai_job_state")
    .update({ lease_until: null, updated_at: new Date().toISOString() })
    .eq("job_name", job);
}

export async function pauseJob(admin: Admin, job: JobName, reason: string) {
  await admin
    .from("ai_job_state")
    .update({
      status: "paused",
      paused_reason: reason.slice(0, 500),
      lease_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("job_name", job);
}

export async function resumeJob(admin: Admin, job: JobName) {
  await admin
    .from("ai_job_state")
    .update({ status: "idle", paused_reason: null, updated_at: new Date().toISOString() })
    .eq("job_name", job);
}
