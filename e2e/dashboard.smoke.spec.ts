/**
 * Smoke test — Dashboard
 *
 * These tests run with a mocked authenticated session using
 * Next-Auth's NEXTAUTH_URL + test credentials supplied via env vars.
 *
 * If TEST_SESSION_TOKEN is not provided the tests are skipped so the
 * suite does not block CI on repos that have no test account configured.
 *
 * To run with a real session:
 *   TEST_SESSION_TOKEN=<value> npx playwright test e2e/dashboard.smoke.spec.ts
 */

import { test, expect } from "@playwright/test";

const hasSession = !!process.env.TEST_SESSION_TOKEN;

test.describe("Dashboard smoke", () => {
  test.beforeEach(async ({ page, context }) => {
    if (hasSession) {
      // Inject the session cookie so Next-Auth treats the request as authenticated
      await context.addCookies([
        {
          name: "next-auth.session-token",
          value: process.env.TEST_SESSION_TOKEN!,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ]);
    }
  });

  test("unauthenticated: /dashboard redirects to /login", async ({ page }) => {
    // This runs regardless of TEST_SESSION_TOKEN
    if (hasSession) test.skip();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("authenticated: dashboard page loads", async ({ page }) => {
    if (!hasSession) test.skip();
    await page.goto("/dashboard");
    // Must not redirect away from dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("authenticated: dashboard page has page heading or form list area", async ({
    page,
  }) => {
    if (!hasSession) test.skip();
    await page.goto("/dashboard");
    // Heading text or the main landmark must be present
    const main = page.locator("main").first();
    await expect(main).toBeVisible();
  });

  test("authenticated: upload link is accessible from dashboard", async ({
    page,
  }) => {
    if (!hasSession) test.skip();
    await page.goto("/dashboard");
    // There should be a link or button to upload a form
    const uploadLink = page
      .getByRole("link", { name: /upload/i })
      .or(page.getByRole("button", { name: /upload/i }))
      .first();
    await expect(uploadLink).toBeVisible();
  });
});
