/**
 * Smoke test — Form detail page
 *
 * Verifies that navigating to /dashboard/forms/:id:
 * - Requires authentication (unauthenticated → redirect)
 * - Renders the form page UI for a known form id (when session is present)
 *
 * A real form id must be supplied via SMOKE_FORM_ID env var for the
 * authenticated tests to run against the correct record.
 */

import { test, expect } from "@playwright/test";

const hasSession = !!process.env.TEST_SESSION_TOKEN;
const formId = process.env.SMOKE_FORM_ID ?? "";

test.describe("Form detail smoke", () => {
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

  test("unauthenticated: /dashboard/forms/:id redirects to /login", async ({
    page,
  }) => {
    if (hasSession) test.skip();
    await page.goto("/dashboard/forms/some-random-id");
    await expect(page).toHaveURL(/\/login/);
  });

  test("authenticated with valid form id: form detail page loads", async ({
    page,
  }) => {
    if (!hasSession || !formId) test.skip();
    await page.goto(`/dashboard/forms/${formId}`);
    await expect(page).toHaveURL(new RegExp(`/dashboard/forms/${formId}`));
  });

  test("authenticated with valid form id: main content area is visible", async ({
    page,
  }) => {
    if (!hasSession || !formId) test.skip();
    await page.goto(`/dashboard/forms/${formId}`);
    const main = page.locator("main").first();
    await expect(main).toBeVisible();
  });

  test("authenticated: unknown form id returns 404 page", async ({ page }) => {
    if (!hasSession) test.skip();
    // A gibberish id should hit Next.js notFound() and render a 404 page
    const response = await page.goto(
      "/dashboard/forms/00000000-0000-0000-0000-000000000000"
    );
    // Either a 404 status code, or the word "not found" in the body
    const status = response?.status() ?? 0;
    const body = await page.locator("body").innerText();
    const is404 = status === 404 || /not found/i.test(body);
    expect(is404).toBe(true);
  });
});
