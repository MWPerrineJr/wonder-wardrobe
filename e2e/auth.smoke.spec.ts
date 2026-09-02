import { expect, test } from "@playwright/test";

/**
 * Public auth screens only. Shop listing, booking, Checkout, refunds, and
 * signed-in owner/provider flows need a live Supabase project and Stripe
 * sandbox; those stay out of CI until E2E_FULL is wired to that environment.
 */
test.beforeEach(async ({ page }) => {
  await page.route(/supabase\.co/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
});

test.describe("public auth screens", () => {
  test("sign-in form is reachable", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create an account" })).toBeVisible();
  });

  test("sign-up form is reachable", async ({ page }) => {
    await page.goto("/auth?mode=sign_up");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByPlaceholder("Your name")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("reset-password rejects a missing recovery session", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "Back to sign in" })).toBeVisible();
  });
});
