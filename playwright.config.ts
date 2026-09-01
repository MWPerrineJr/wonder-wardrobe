import { defineConfig, devices } from "@playwright/test";

const defaults: Record<string, string> = {
  PAYMENTS_ENV: "sandbox",
  VITE_PAYMENTS_ENV: "sandbox",
  STRIPE_SANDBOX_API_KEY: "ci_sandbox_stripe_connection",
  PAYMENTS_SANDBOX_WEBHOOK_SECRET: "ci_sandbox_webhook_secret",
  LOVABLE_API_KEY: "ci_lovable_api_key",
  APP_URL: "http://127.0.0.1:4173",
  JOB_SECRET: "ci-job-secret-must-be-at-least-32-chars",
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_placeholder",
  VITE_SUPABASE_PROJECT_ID: "ci",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_placeholder",
  SUPABASE_PROJECT_ID: "ci",
};

const webServerEnv: Record<string, string> = { ...defaults };
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) webServerEnv[key] = value;
}

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/auth",
    reuseExistingServer: false,
    timeout: 120_000,
    env: webServerEnv,
  },
});
