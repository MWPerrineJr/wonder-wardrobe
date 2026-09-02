import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertPaymentsConfig,
  inspectPaymentsConfig,
  parsePaymentsEnv,
  PaymentsConfigError,
  requirePaymentsEnv,
} from "./payments-env.ts";

const sandbox = {
  PAYMENTS_ENV: "sandbox",
  STRIPE_SANDBOX_API_KEY: "conn_sandbox",
  PAYMENTS_SANDBOX_WEBHOOK_SECRET: "whsec_sandbox",
  LOVABLE_API_KEY: "lovable_key",
  VITE_PAYMENTS_ENV: "sandbox",
  VITE_PAYMENTS_CLIENT_TOKEN: "pk_test_abc",
};

describe("parsePaymentsEnv", () => {
  it("accepts only sandbox or live", () => {
    assert.equal(parsePaymentsEnv("sandbox"), "sandbox");
    assert.equal(parsePaymentsEnv("live"), "live");
    assert.throws(() => parsePaymentsEnv(undefined), PaymentsConfigError);
    assert.throws(() => parsePaymentsEnv("prod"), PaymentsConfigError);
  });

  it("does not treat a live secret as selecting live mode", () => {
    assert.throws(() => parsePaymentsEnv(""), PaymentsConfigError);
  });
});

describe("assertPaymentsConfig", () => {
  it("accepts a complete sandbox deployment even when a live key is also present", () => {
    const config = assertPaymentsConfig({
      ...sandbox,
      STRIPE_LIVE_API_KEY: "conn_live",
      PAYMENTS_LIVE_WEBHOOK_SECRET: "whsec_live",
    });
    assert.equal(config.env, "sandbox");
    assert.equal(config.stripeKeyName, "STRIPE_SANDBOX_API_KEY");
  });

  it("requires live credentials when PAYMENTS_ENV=live", () => {
    assert.throws(
      () =>
        assertPaymentsConfig({
          PAYMENTS_ENV: "live",
          STRIPE_SANDBOX_API_KEY: "conn_sandbox",
          PAYMENTS_SANDBOX_WEBHOOK_SECRET: "whsec_sandbox",
          LOVABLE_API_KEY: "lovable_key",
        }),
      PaymentsConfigError,
    );
    const config = assertPaymentsConfig({
      PAYMENTS_ENV: "live",
      STRIPE_LIVE_API_KEY: "conn_live",
      PAYMENTS_LIVE_WEBHOOK_SECRET: "whsec_live",
      LOVABLE_API_KEY: "lovable_key",
      VITE_PAYMENTS_ENV: "live",
      VITE_PAYMENTS_CLIENT_TOKEN: "pk_live_abc",
    });
    assert.equal(config.env, "live");
  });

  it("rejects a live publishable token on a sandbox deployment", () => {
    assert.throws(
      () =>
        assertPaymentsConfig({
          ...sandbox,
          VITE_PAYMENTS_CLIENT_TOKEN: "pk_live_abc",
        }),
      PaymentsConfigError,
    );
  });

  it("requires VITE_PAYMENTS_ENV when the publishable token is not a Stripe pk_ key", () => {
    assert.throws(
      () =>
        assertPaymentsConfig({
          PAYMENTS_ENV: "sandbox",
          STRIPE_SANDBOX_API_KEY: "conn_sandbox",
          PAYMENTS_SANDBOX_WEBHOOK_SECRET: "whsec_sandbox",
          LOVABLE_API_KEY: "lovable_key",
        }),
      PaymentsConfigError,
    );
  });

  it("rejects VITE_PAYMENTS_ENV that disagrees with PAYMENTS_ENV", () => {
    assert.throws(
      () => assertPaymentsConfig({ ...sandbox, VITE_PAYMENTS_ENV: "live" }),
      PaymentsConfigError,
    );
  });
});

describe("requirePaymentsEnv", () => {
  it("rejects a client request for the other mode", () => {
    assert.equal(requirePaymentsEnv("sandbox", sandbox), "sandbox");
    assert.throws(() => requirePaymentsEnv("live", sandbox), PaymentsConfigError);
  });
});

describe("inspectPaymentsConfig", () => {
  it("reports issues without throwing", () => {
    const diagnostic = inspectPaymentsConfig({ STRIPE_LIVE_API_KEY: "conn_live" });
    assert.equal(diagnostic.ok, false);
    assert.equal(diagnostic.environment, null);
    assert.ok(diagnostic.issues[0]?.includes("PAYMENTS_ENV"));
  });
});
