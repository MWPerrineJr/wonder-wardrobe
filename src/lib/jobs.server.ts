// Shared plumbing for the scheduled feedback jobs: caller auth, single-flight
// leases and the pause/probe circuit breaker. Service-role only — never
// imported from client-reachable modules.

export type JobName = "send-surveys" | "enrich-feedback" | "build-reports";

export function isAuthorizedJobCall(request: Request) {
  const key = request.headers.get("apikey") ?? request.headers.get("x-api-key");
  const expected =
    process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
  return Boolean(key) && Boolean(expected) && key === expected;
}

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type JobLease =
  | { ok: true; paused: false; probeOnly: false }
  | { ok: true; paused: true; probeOnly: true; reason: string | null }
  | { ok: false; skipped: "locked" };

const LEASE_MINUTES = 10;

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