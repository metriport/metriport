import { test, expect } from "@playwright/test";
import { MetriportDevicesApi } from "@metriport/api-sdk";
import { getTestConfig } from "./shared";

const widgetUrl = getTestConfig().widgetUrl;
const apiUrl = getTestConfig().apiUrl;
const testApiKey = "";

const metriportClient = new MetriportDevicesApi(testApiKey, { baseAddress: apiUrl });
console.log(metriportClient);

test("has title", async ({ page }) => {
  const appId = "1234";
  const userId = await metriportClient.getMetriportUserId(appId);
  const token = await metriportClient.getConnectToken(userId);

  await page.goto(`${widgetUrl}/?token=${token}`);

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

test("get started link", async ({ page }) => {
  await page.goto("https://playwright.dev/");

  // Click the get started link.
  await page.getByRole("link", { name: "Get started" }).click();

  // Expects the URL to contain intro.
  await expect(page).toHaveURL(/.*intro/);
});
