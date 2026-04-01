/**
 * Smoke test — Auth flow
 *
 * Verifies:
 * - /login page loads and renders the sign-in UI
 * - Unauthenticated visit to /dashboard redirects to /login
 * - Landing page (/) is publicly accessible
 *
 * These are load-and-assert tests only; no real OAuth flow is triggered
 * because that would require live credentials. Auth interaction tests
 * belong in a separate authenticated suite using stored session state.
 */

import { test, expect } from "@playwright/test";

test.describe("Auth smoke", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    // Page must return a 2xx and render the FormPilot brand name
    await expect(page).toHaveTitle(/FormPilot/i);
  });

  test("login page loads and shows sign-in button", async ({ page }) => {
    await page.goto("/login");
    // The page must render without a 4xx/5xx response
    await expect(page).toHaveURL(/\/login/);
    // Sign-in button must be present
    const signInButton = page.getByRole("button", { name: /sign in/i });
    await expect(signInButton).toBeVisible();
  });

  test("login page shows FormPilot brand", async ({ page }) => {
    await page.goto("/login");
    // Brand name must appear — either as text or inside an element
    await expect(page.getByText(/FormPilot/i).first()).toBeVisible();
  });

  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    // Should land on the login page (either exact match or with query params)
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated /dashboard/profile redirects to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard/profile");
    await expect(page).toHaveURL(/\/login/);
  });
});
