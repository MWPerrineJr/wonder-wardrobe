import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { livenessReport, readinessReport } from "./health.ts";

describe("livenessReport", () => {
  it("is always ok", () => {
    assert.equal(livenessReport(new Date("2026-09-01T12:00:00.000Z")).status, "ok");
  });
});

describe("readinessReport", () => {
  it("is not_ready when payments config is incomplete", () => {
    const report = readinessReport(false, ["PAYMENTS_ENV must be set"]);
    assert.equal(report.status, "not_ready");
    assert.equal(report.payments, "incomplete");
    assert.equal(report.issues.length, 1);
  });
});
