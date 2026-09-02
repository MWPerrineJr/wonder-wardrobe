import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emailStatusAfterAttempt,
  enrichmentStatusAfterAttempt,
  isRetryableEmailStatus,
  nextAttemptIso,
  remainingDailyBudget,
  sanitizeJobError,
  shouldAlertPaused,
  surveyAttemptPatch,
  surveyIdempotencyKey,
  SURVEY_MAX_ATTEMPTS,
} from "./job-retry.ts";

describe("survey retry policy", () => {
  it("keeps one stable idempotency key per invite token", () => {
    assert.equal(surveyIdempotencyKey("tok-1"), "survey-invite-tok-1");
  });

  it("retries pending, failed, and blocked invites but not sent or dead-lettered ones", () => {
    assert.equal(isRetryableEmailStatus("pending"), true);
    assert.equal(isRetryableEmailStatus("failed"), true);
    assert.equal(isRetryableEmailStatus("blocked"), true);
    assert.equal(isRetryableEmailStatus("sent"), false);
    assert.equal(isRetryableEmailStatus("dead_letter"), false);
  });

  it("dead-letters after the maximum attempts", () => {
    assert.equal(emailStatusAfterAttempt("failed", SURVEY_MAX_ATTEMPTS - 1), "failed");
    assert.equal(emailStatusAfterAttempt("failed", SURVEY_MAX_ATTEMPTS), "dead_letter");
    assert.equal(emailStatusAfterAttempt("sent", 99), "sent");
  });

  it("backs off exponentially and records a sent attempt as terminal success", () => {
    const first = Date.parse(nextAttemptIso(1, Date.parse("2026-09-01T12:00:00.000Z")));
    const second = Date.parse(nextAttemptIso(2, Date.parse("2026-09-01T12:00:00.000Z")));
    assert.ok(second - first >= 14 * 60 * 1000);

    const patch = surveyAttemptPatch(0, "sent", "should not stick");
    assert.equal(patch.email_status, "sent");
    assert.equal(patch.email_error, null);
    assert.equal(patch.email_next_attempt_at, null);
    assert.equal(patch.email_attempts, 1);
  });
});

describe("AI item retry and spend caps", () => {
  it("marks enrichment dead-letter after repeated failures", () => {
    assert.equal(enrichmentStatusAfterAttempt(true, 1), "done");
    assert.equal(enrichmentStatusAfterAttempt(false, 5), "failed");
    assert.equal(enrichmentStatusAfterAttempt(false, 6), "dead_letter");
  });

  it("resets the daily budget on a new date", () => {
    assert.equal(remainingDailyBudget(200, "2026-08-31", 200, "2026-09-01"), 200);
    assert.equal(remainingDailyBudget(200, "2026-09-01", 200, "2026-09-01"), 0);
  });

  it("alerts when a job stays paused for more than an hour", () => {
    assert.equal(
      shouldAlertPaused("2026-09-01T10:00:00.000Z", Date.parse("2026-09-01T11:00:00.000Z")),
      true,
    );
    assert.equal(
      shouldAlertPaused("2026-09-01T10:30:00.000Z", Date.parse("2026-09-01T11:00:00.000Z")),
      false,
    );
  });

  it("redacts secrets from stored job errors", () => {
    assert.equal(
      sanitizeJobError("Bearer abcdefghijklmnopqrstuv wx sk_live_abc123xyz"),
      "Bearer [redacted] wx [redacted]",
    );
  });
});
