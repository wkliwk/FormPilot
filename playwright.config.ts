import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for FormPilot E2E smoke tests.
 * Dev server runs on port 3300 (npm run dev).
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Reporter */
  reporter: process.env.CI ? "github" : "list",
  use: {
    /* Base URL so tests can use relative paths like page.goto('/login') */
    baseURL: process.env.BASE_URL ?? "http://localhost:3300",
    /* Collect trace on first retry */
    trace: "on-first-retry",
    /* Screenshot on failure */
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  /* Run local dev server before starting the tests when not in CI */
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3300",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
