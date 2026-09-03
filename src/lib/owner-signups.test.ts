import { describe, expect, it } from "vitest";

import { ownerPlanState } from "./payments-webhook.logic";
import { TRIAL_DAYS } from "./trial";

describe("trial length", () => {
  it("is 90 days for new subscriptions", () => {
    expect(TRIAL_DAYS).toBe(90);
  });
});

describe("ownerPlanState", () => {
  it("maps Stripe statuses onto registry states", () => {
    expect(ownerPlanState("trialing")).toBe("trialing");
    expect(ownerPlanState("active")).toBe("active");
    expect(ownerPlanState("past_due")).toBe("past_due");
    expect(ownerPlanState("unpaid")).toBe("past_due");
    expect(ownerPlanState("canceled")).toBe("canceled");
    expect(ownerPlanState("incomplete_expired")).toBe("canceled");
    expect(ownerPlanState("incomplete")).toBe("none");
  });
});
