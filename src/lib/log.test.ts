import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redactSecrets, redactUnknown } from "./log.ts";

describe("redactSecrets", () => {
  it("strips Stripe keys, webhook secrets, and bearer tokens", () => {
    assert.equal(redactSecrets("sk_live_abc123xyz"), "[redacted]");
    assert.equal(redactSecrets("Bearer super-secret-token"), "Bearer [redacted]");
    assert.equal(redactSecrets("whsec_abc"), "[redacted]");
  });
});

describe("redactUnknown", () => {
  it("reads Error messages", () => {
    assert.equal(redactUnknown(new Error("Bearer abcdef")), "Bearer [redacted]");
  });
});
