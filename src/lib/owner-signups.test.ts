import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ownerPlanState } from "./payments-webhook.logic.ts";
import { TRIAL_DAYS } from "./trial.ts";

describe("trial length", () => {
  it("is 90 days for new subscriptions", () => {
    assert.equal(TRIAL_DAYS, 90);
  });
});

describe("ownerPlanState", () => {
  it("maps Stripe statuses onto registry states", () => {
    assert.equal(ownerPlanState("trialing"), "trialing");
    assert.equal(ownerPlanState("active"), "active");
    assert.equal(ownerPlanState("past_due"), "past_due");
    assert.equal(ownerPlanState("unpaid"), "past_due");
    assert.equal(ownerPlanState("canceled"), "canceled");
    assert.equal(ownerPlanState("incomplete_expired"), "canceled");
    assert.equal(ownerPlanState("incomplete"), "none");
  });
});
