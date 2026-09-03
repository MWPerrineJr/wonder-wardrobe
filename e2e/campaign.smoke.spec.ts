import { expect, test } from "@playwright/test";

const CAMPAIGN_SOURCES = ["linkedin", "instagram", "facebook"] as const;

for (const source of CAMPAIGN_SOURCES) {
  test(`campaign link for ${source} loads and stores attribution`, async ({ page }) => {
    const response = await page.goto(
      `/onboarding/owner?utm_source=${source}&utm_medium=social&utm_campaign=founding-shops&utm_content=week1-launch`,
      { waitUntil: "domcontentloaded" },
    );
    expect(response?.status()).toBeLessThan(400);

    // Unauthenticated visitors land on sign-in; the campaign must survive the redirect.
    await page.waitForURL(/\/(auth|onboarding\/owner)/);
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem("tsc.campaign.v1")), {
        timeout: 10_000,
      })
      .not.toBeNull();

    const stored = JSON.parse(
      (await page.evaluate(() => localStorage.getItem("tsc.campaign.v1"))) ?? "{}",
    );
    expect(stored.utm_source).toBe(source);
    expect(stored.utm_medium).toBe("social");
    expect(stored.utm_campaign).toBe("founding-shops");
    expect(stored.utm_content).toBe("week1-launch");
  });
}
