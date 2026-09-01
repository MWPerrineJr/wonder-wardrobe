import { expect, test } from "@playwright/test";

test.describe("operational endpoints", () => {
  test("liveness does not depend on payments config", async ({ request }) => {
    const response = await request.get("/api/public/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      service: "the-standing-chair",
    });
  });

  test("readiness is ok when CI payments env is set", async ({ request }) => {
    const response = await request.get("/api/public/ready");
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      payments: "ok",
    });
  });
});
