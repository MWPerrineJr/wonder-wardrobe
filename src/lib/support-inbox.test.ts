import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sanitizeHeader } from "./support-inbox.server.ts";

describe("sanitizeHeader", () => {
  it("prevents CRLF injection in outbound Gmail headers", () => {
    assert.equal(
      sanitizeHeader("customer@example.com\r\nBcc: attacker@example.com"),
      "customer@example.com Bcc: attacker@example.com",
    );
  });

  it("trims safe header values", () => {
    assert.equal(sanitizeHeader("  <message-id@example.com>  "), "<message-id@example.com>");
  });
});
