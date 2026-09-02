import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ReturnUrlError, resolveAppReturnUrl, withSearchParams } from "./return-url.ts";

const prod = { APP_URL: "https://thestandingchair.com" };

describe("resolveAppReturnUrl", () => {
  it("builds relative paths from APP_URL", () => {
    assert.equal(
      resolveAppReturnUrl("/account", { env: prod }),
      "https://thestandingchair.com/account",
    );
    assert.equal(
      resolveAppReturnUrl("/owner/feedback?billing=complete", { env: prod }),
      "https://thestandingchair.com/owner/feedback?billing=complete",
    );
  });

  it("uses the fallback path when the client omits a return URL", () => {
    assert.equal(
      resolveAppReturnUrl(undefined, { fallbackPath: "/account", env: prod }),
      "https://thestandingchair.com/account",
    );
  });

  it("rejects missing APP_URL", () => {
    assert.throws(() => resolveAppReturnUrl("/account", { env: {} }), ReturnUrlError);
  });

  it("rejects protocol-relative, non-http, and credential-bearing URLs", () => {
    assert.throws(() => resolveAppReturnUrl("//evil.example/phish", { env: prod }), ReturnUrlError);
    assert.throws(() => resolveAppReturnUrl("javascript:alert(1)", { env: prod }), ReturnUrlError);
    assert.throws(
      () => resolveAppReturnUrl("https://user:pass@thestandingchair.com/account", { env: prod }),
      ReturnUrlError,
    );
  });

  it("rejects external origins and non-HTTPS production URLs", () => {
    assert.throws(
      () => resolveAppReturnUrl("https://evil.example/account", { env: prod }),
      ReturnUrlError,
    );
    assert.throws(
      () => resolveAppReturnUrl("http://thestandingchair.com/account", { env: prod }),
      ReturnUrlError,
    );
  });

  it("accepts an allowlisted preview origin", () => {
    const env = {
      APP_URL: "https://thestandingchair.com",
      APP_URL_ALLOWLIST: "https://preview.example",
    };
    assert.equal(
      resolveAppReturnUrl("https://preview.example/owner?payouts=return", { env }),
      "https://preview.example/owner?payouts=return",
    );
  });

  it("allows http only on loopback APP_URL", () => {
    const env = { APP_URL: "http://localhost:5173" };
    assert.equal(resolveAppReturnUrl("/account", { env }), "http://localhost:5173/account");
    assert.equal(
      resolveAppReturnUrl("http://127.0.0.1:5173/account", { env }),
      "http://127.0.0.1:5173/account",
    );
  });
});

describe("withSearchParams", () => {
  it("appends booking result flags without dropping existing query params", () => {
    assert.equal(
      withSearchParams("https://thestandingchair.com/account", {
        paid: "1",
        booking: "book-1",
      }),
      "https://thestandingchair.com/account?paid=1&booking=book-1",
    );
  });
});
