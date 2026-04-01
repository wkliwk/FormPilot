/**
 * Smoke test — Profile page
 *
 * Verifies that /dashboard/profile:
 * - Requires authentication (unauthenticated → redirect)
 * - Renders the Profile Vault heading and form fields when authenticated
 */

import { test, expect } from "@playwright/test";

const hasSession = !!process.env.TEST_SESSION_TOKEN;

test.describe("Profile smoke", () => {
  test.beforeEach(async ({ context }) => {
    if (hasSession) {
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

  test("unauthenticated: /dashboard/profile redirects to /login", async ({
    page,
  }) => {
    if (hasSession) test.skip();
    await page.goto("/dashboard/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("authenticated: profile page loads without error", async ({ page }) => {
    if (!hasSession) test.skip();
    await page.goto("/dashboard/profile");
    await expect(page).toHaveURL(/\/dashboard\/profile/);
  });

  test("authenticated: Profile Vault heading is visible", async ({ page }) => {
    if (!hasSession) test.skip();
    await page.goto("/dashboard/profile");
    await expect(
      page.getByRole("heading", { name: /Profile Vault/i })
    ).toBeVisible();
  });

  test("authenticated: profile form has at least one input field", async ({
    page,
  }) => {
    if (!hasSession) test.skip();
    await page.goto("/dashboard/profile");
    // The profile form must render editable fields
    const inputs = page.locator("input, textarea, select");
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test("authenticated: breadcrumb back-link to dashboard is present", async ({
    page,
  }) => {
    if (!hasSession) test.skip();
    await page.goto("/dashboard/profile");
    const dashboardLink = page.getByRole("link", { name: /dashboard/i });
    await expect(dashboardLink).toBeVisible();
  });
});
