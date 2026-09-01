import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeReturnPath } from "./return-path.ts";

describe("normalizeReturnPath", () => {
  it("accepts relative paths with query strings", () => {
    assert.equal(normalizeReturnPath("/account"), "/account");
    assert.equal(normalizeReturnPath("/owner?payouts=return"), "/owner?payouts=return");
    assert.equal(normalizeReturnPath("  /owner/feedback  "), "/owner/feedback");
  });

  it("rejects absolute and protocol-relative URLs (open redirect)", () => {
    for (const bad of [
      "https://evil.example/steal",
      "http://evil.example",
      "//evil.example/steal",
      "javascript:alert(1)",
      "/\\evil.example",
      "account",
      "",
    ]) {
      assert.equal(normalizeReturnPath(bad), null, `should reject ${JSON.stringify(bad)}`);
    }
  });

  it("rejects control characters, oversized values and non-strings", () => {
    assert.equal(normalizeReturnPath("/ok\nSet-Cookie: x=1"), null);
    assert.equal(normalizeReturnPath(`/${"a".repeat(600)}`), null);
    assert.equal(normalizeReturnPath(undefined), null);
    assert.equal(normalizeReturnPath(42), null);
  });
});
