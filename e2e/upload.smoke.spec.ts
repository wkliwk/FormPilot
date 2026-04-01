/**
 * Smoke test — Upload flow
 *
 * Verifies that the upload page renders correctly (unauthenticated → redirect,
 * authenticated → form rendered) and that the file input element is present.
 *
 * Actual PDF parsing is not tested here — that requires a running AI integration
 * and a live database. Use integration tests for that path.
 */

import path from "path";
import { test, expect } from "@playwright/test";

const hasSession = !!process.env.TEST_SESSION_TOKEN;
const FIXTURE_PDF = path.join(__dirname, "fixtures", "sample-form.pdf");

test.describe("Upload smoke", () => {
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

  test("unauthenticated: /dashboard/upload redirects to /login", async ({
    page,
  }) => {
    if (hasSession) test.skip();
    await page.goto("/dashboard/upload");
    await expect(page).toHaveURL(/\/login/);
  });

  test("authenticated: upload page loads", async ({ page }) => {
    if (!hasSession) test.skip();
    await page.goto("/dashboard/upload");
    await expect(page).toHaveURL(/\/dashboard\/upload/);
  });

  test("authenticated: upload page renders file input area", async ({
    page,
  }) => {
    if (!hasSession) test.skip();
    await page.goto("/dashboard/upload");
    // The page should have a file input or a drop-zone button
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
  });

  test("authenticated: upload page shows accepted file types hint", async ({
    page,
  }) => {
    if (!hasSession) test.skip();
    await page.goto("/dashboard/upload");
    // Some indication of PDF/Word acceptance should be visible
    const bodyText = await page.locator("body").innerText();
    const mentionsPDF = /pdf/i.test(bodyText);
    expect(mentionsPDF).toBe(true);
  });

  test("authenticated: can attach a PDF fixture to the file input", async ({
    page,
  }) => {
    if (!hasSession) test.skip();
    await page.goto("/dashboard/upload");
    const fileInput = page.locator('input[type="file"]');
    // Set files without submitting — just verify the input accepts the file
    await fileInput.setInputFiles(FIXTURE_PDF);
    // After attaching, the filename should appear somewhere on the page
    const bodyText = await page.locator("body").innerText();
    expect(/sample-form\.pdf/i.test(bodyText)).toBe(true);
  });
});
