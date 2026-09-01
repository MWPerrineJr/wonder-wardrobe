import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyRequestIdHeader, readRequestId, requestWithId } from "./request-id.ts";

describe("readRequestId", () => {
  it("prefers x-request-id, then cf-ray", () => {
    const fromHeader = readRequestId(
      new Request("https://example.test/", { headers: { "x-request-id": "req-1" } }),
    );
    assert.equal(fromHeader, "req-1");
    const fromRay = readRequestId(
      new Request("https://example.test/", { headers: { "cf-ray": "ray-9" } }),
    );
    assert.equal(fromRay, "ray-9");
  });
});

describe("requestWithId", () => {
  it("copies the id onto the request", () => {
    const tagged = requestWithId(new Request("https://example.test/"), "abc");
    assert.equal(tagged.headers.get("x-request-id"), "abc");
  });

  it("does not require cloning the incoming Request object", () => {
    const request = new Request("https://example.test/", { method: "GET" });
    const tagged = requestWithId(request, "abc");
    assert.equal(tagged.url, request.url);
    assert.equal(tagged.headers.get("x-request-id"), "abc");
  });
});

describe("applyRequestIdHeader", () => {
  it("sets the response header when missing", () => {
    const response = applyRequestIdHeader(new Response("ok"), "abc");
    assert.equal(response.headers.get("x-request-id"), "abc");
  });
});
