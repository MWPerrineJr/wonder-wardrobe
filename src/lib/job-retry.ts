export const SURVEY_MAX_ATTEMPTS = 8;
export const ENRICH_MAX_ATTEMPTS = 6;
export const ENRICH_DAILY_CAP = 200;
export const REPORT_DAILY_CAP = 40;
export const PAUSED_ALERT_AFTER_MS = 60 * 60 * 1000;
export const CONSECUTIVE_FAILURE_ALERT = 5;

const MIN_BACKOFF_MS = 15 * 60 * 1000;
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;

export type EmailAttemptOutcome = "sent" | "blocked" | "failed";

export function surveyIdempotencyKey(token: string): string {
  return `survey-invite-${token}`;
}

export function isRetryableEmailStatus(status: string): boolean {
  return status === "pending" || status === "failed" || status === "blocked";
}

export function nextAttemptIso(attemptsAfterThis: number, nowMs = Date.now()): string {
  const exp = Math.min(Math.max(attemptsAfterThis - 1, 0), 10);
  const delay = Math.min(MAX_BACKOFF_MS, MIN_BACKOFF_MS * 2 ** exp);
  return new Date(nowMs + delay).toISOString();
}

export function emailStatusAfterAttempt(
  outcome: EmailAttemptOutcome,
  attempts: number,
  max = SURVEY_MAX_ATTEMPTS,
): "sent" | "blocked" | "failed" | "dead_letter" {
  if (outcome === "sent") return "sent";
  if (attempts >= max) return "dead_letter";
  return outcome;
}

export function enrichmentStatusAfterAttempt(
  ok: boolean,
  attempts: number,
  max = ENRICH_MAX_ATTEMPTS,
): "done" | "failed" | "dead_letter" {
  if (ok) return "done";
  if (attempts >= max) return "dead_letter";
  return "failed";
}

export function sanitizeJobError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/sk_(live|test)_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

export function shouldAlertPaused(pausedAt: string | null | undefined, nowMs = Date.now()): boolean {
  if (!pausedAt) return false;
  const t = Date.parse(pausedAt);
  return Number.isFinite(t) && nowMs - t >= PAUSED_ALERT_AFTER_MS;
}

export function remainingDailyBudget(
  itemsToday: number,
  itemsOnDate: string | null | undefined,
  cap: number,
  today = new Date().toISOString().slice(0, 10),
): number {
  const used = itemsOnDate === today ? itemsToday : 0;
  return Math.max(0, cap - used);
}

export function surveyAttemptPatch(
  previousAttempts: number,
  outcome: EmailAttemptOutcome,
  error: string | null,
  now = new Date(),
) {
  const attempts = previousAttempts + 1;
  const status = emailStatusAfterAttempt(outcome, attempts);
  return {
    email_attempts: attempts,
    email_last_attempt_at: now.toISOString(),
    email_status: status,
    email_error: status === "sent" ? null : error,
    emailed_at: status === "sent" ? now.toISOString() : null,
    email_next_attempt_at: status === "sent" || status === "dead_letter" ? null : nextAttemptIso(attempts, now.getTime()),
  };
}
