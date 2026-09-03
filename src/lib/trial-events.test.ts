import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TRIAL_DAYS } from "./trial.ts";
import {
  shouldRecordTrialEvent,
  signupTrialEndsAt,
  trialEventForPlanState,
} from "./trial-events.ts";

describe("signupTrialEndsAt", () => {
  it("adds exactly the trial length to the signup date", () => {
    const start = "2026-01-01T00:00:00.000Z";
    const end = new Date(signupTrialEndsAt(start)).getTime();
    assert.equal(end - new Date(start).getTime(), TRIAL_DAYS * 24 * 60 * 60 * 1000);
  });

  it("accepts a Date and returns an ISO string", () => {
    const value = signupTrialEndsAt(new Date("2026-06-15T12:00:00.000Z"));
    assert.match(value, /^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("trialEventForPlanState", () => {
  it("maps billing states onto history events", () => {
    assert.equal(trialEventForPlanState("trialing"), "stripe_trial_started");
    assert.equal(trialEventForPlanState("active"), "converted_paid");
    assert.equal(trialEventForPlanState("past_due"), "past_due");
    assert.equal(trialEventForPlanState("canceled"), "canceled");
    assert.equal(trialEventForPlanState("lifetime"), "lifetime");
  });

  it("has no event for a shop with no plan", () => {
    assert.equal(trialEventForPlanState("none"), null);
    assert.equal(trialEventForPlanState("whatever"), null);
  });
});

describe("shouldRecordTrialEvent", () => {
  it("records the first transition into a state", () => {
    assert.equal(shouldRecordTrialEvent("none", "trialing"), true);
    assert.equal(shouldRecordTrialEvent("trialing", "active"), true);
  });

  it("skips webhook replays of the same state", () => {
    assert.equal(shouldRecordTrialEvent("active", "active"), false);
    assert.equal(shouldRecordTrialEvent("trialing", "trialing"), false);
  });

  it("skips states with no history event", () => {
    assert.equal(shouldRecordTrialEvent("active", "none"), false);
  });

  it("records when there is no previous row", () => {
    assert.equal(shouldRecordTrialEvent(null, "trialing"), true);
    assert.equal(shouldRecordTrialEvent(undefined, "active"), true);
  });
});
