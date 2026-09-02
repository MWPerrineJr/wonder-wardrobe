import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { authorizeJobCall, secretsEqual, type JobRateLimitBucket } from "./jobs.auth.ts";

const SECRET = "a".repeat(32);
const PUBLISHABLE = "sb_publishable_test_key_not_a_secret_xx";

function requestWith(headers: Record<string, string>) {
  return new Request("https://example.test/api/public/jobs/send-surveys", {
    method: "POST",
    headers,
  });
}

describe("authorizeJobCall", () => {
  const originalSecret = process.env["JOB_SECRET"];
  const originalPublishable = process.env["SUPABASE_PUBLISHABLE_KEY"];

  afterEach(() => {
    if (originalSecret === undefined) delete process.env["JOB_SECRET"];
    else process.env["JOB_SECRET"] = originalSecret;
    if (originalPublishable === undefined) delete process.env["SUPABASE_PUBLISHABLE_KEY"];
    else process.env["SUPABASE_PUBLISHABLE_KEY"] = originalPublishable;
  });

  it("returns 503 when JOB_SECRET is missing", () => {
    const result = authorizeJobCall(requestWith({ Authorization: `Bearer ${SECRET}` }), {
      secret: "",
      publishableKey: PUBLISHABLE,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 503);
      assert.equal(result.reason, "missing_server_secret");
    }
  });

  it("returns 503 when JOB_SECRET equals the publishable key", () => {
    const result = authorizeJobCall(requestWith({ Authorization: `Bearer ${PUBLISHABLE}` }), {
      secret: PUBLISHABLE,
      publishableKey: PUBLISHABLE,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 503);
      assert.equal(result.reason, "insecure_secret");
    }
  });

  it("returns 401 when the Authorization header is missing", () => {
    const result = authorizeJobCall(requestWith({}), {
      secret: SECRET,
      publishableKey: PUBLISHABLE,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.equal(result.reason, "missing_bearer");
    }
  });

  it("returns 401 when the publishable key is sent as apikey", () => {
    const result = authorizeJobCall(requestWith({ apikey: PUBLISHABLE }), {
      secret: SECRET,
      publishableKey: PUBLISHABLE,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.equal(result.reason, "missing_bearer");
    }
  });

  it("returns 401 when the publishable key is sent as Bearer", () => {
    const result = authorizeJobCall(requestWith({ Authorization: `Bearer ${PUBLISHABLE}` }), {
      secret: SECRET,
      publishableKey: PUBLISHABLE,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.equal(result.reason, "mismatch");
    }
  });

  it("returns 401 for an incorrect bearer token", () => {
    const result = authorizeJobCall(requestWith({ Authorization: `Bearer ${"b".repeat(32)}` }), {
      secret: SECRET,
      publishableKey: PUBLISHABLE,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.equal(result.reason, "mismatch");
    }
  });

  it("succeeds for the correct scheduler secret", () => {
    const result = authorizeJobCall(requestWith({ Authorization: `Bearer ${SECRET}` }), {
      secret: SECRET,
      publishableKey: PUBLISHABLE,
    });
    assert.deepEqual(result, { ok: true });
  });

  it("rate-limits repeated failures from the same client", () => {
    const buckets = new Map<string, JobRateLimitBucket>();
    const headers = {
      Authorization: `Bearer ${"b".repeat(32)}`,
      "cf-connecting-ip": "203.0.113.9",
    };
    let last = authorizeJobCall(requestWith(headers), {
      secret: SECRET,
      publishableKey: PUBLISHABLE,
      buckets,
      now: 1,
    });
    for (let i = 0; i < 21; i++) {
      last = authorizeJobCall(requestWith(headers), {
        secret: SECRET,
        publishableKey: PUBLISHABLE,
        buckets,
        now: 1,
      });
    }
    assert.equal(last.ok, false);
    if (!last.ok) {
      assert.equal(last.status, 429);
      assert.equal(last.reason, "rate_limited");
    }
  });
});

describe("secretsEqual", () => {
  it("accepts equal values and rejects different lengths without throwing", () => {
    assert.equal(secretsEqual("same-token", "same-token"), true);
    assert.equal(secretsEqual("short", "longer-value"), false);
  });
});
