import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applySecurityHeaders, securityHeaders } from "./security-headers.ts";

describe("securityHeaders", () => {
  it("sets CSP, referrer policy, and nosniff", () => {
    const headers = securityHeaders(new Request("https://thestandingchair.com/"));
    assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin");
    assert.equal(headers["x-content-type-options"], "nosniff");
    assert.match(headers["content-security-policy"] ?? "", /default-src 'self'/);
    assert.ok(headers["strict-transport-security"]);
  });

  it("omits HSTS on http", () => {
    const headers = securityHeaders(new Request("http://127.0.0.1:8080/"));
    assert.equal(headers["strict-transport-security"], undefined);
  });
});

describe("applySecurityHeaders", () => {
  it("does not overwrite an existing CSP", () => {
    const existing = new Response("ok", {
      headers: { "content-security-policy": "default-src 'none'" },
    });
    const next = applySecurityHeaders(existing, new Request("https://example.com/"));
    assert.equal(next.headers.get("content-security-policy"), "default-src 'none'");
  });
});
