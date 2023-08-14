import { test, expect } from "@playwright/test";
import { MetriportDevicesApi } from "@metriport/api-sdk";
import { v4 as uuidv4 } from "uuid";
import { getTestConfig } from "./shared";

const widgetUrl = getTestConfig().widgetUrl;
const apiUrl = getTestConfig().apiUrl;
const testApiKey = getTestConfig().testApiKey;

const metriportClient = new MetriportDevicesApi(testApiKey, { baseAddress: apiUrl });

test("check if renders agreement", async ({ page }) => {
  const appId = uuidv4();
  const userId = await metriportClient.getMetriportUserId(appId);
  const token = await metriportClient.getConnectToken(userId);

  await page.goto(`${widgetUrl}/?token=${token}`);

  await expect(
    page.getByRole("heading", { name: "This app uses Metriport to connect your accounts" })
  ).toBeVisible();

  await metriportClient.deleteUser(userId);
});
