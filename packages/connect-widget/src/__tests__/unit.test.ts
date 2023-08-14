import { test, expect } from "@playwright/test";

// STRICTLY SO UNIT TESTS CAN RUN FOR NOW
test("has title", async ({ page }) => {
  await page.goto("https://playwright.dev/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});
