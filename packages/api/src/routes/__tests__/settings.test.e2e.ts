import { MetriportDevicesApi } from "@metriport/api-sdk";
import { testApiKey, baseURL } from "./shared";

jest.setTimeout(15000);

const metriportClient = new MetriportDevicesApi(testApiKey, { baseAddress: baseURL });

describe("Metriport TestSuite", () => {
  it("tests /settings endpoints", async () => {
    // If this is not added i receive this error
    // Jest has detected the following 1 open handle potentially keeping Jest from exiting:
    await process.nextTick(() => {
      return;
    });

    await metriportClient.updateSettings("");

    const TEST_WEBHOOK_URL = "https://test.site/123";

    const getSettingsResp = await metriportClient.getSettings();

    expect(getSettingsResp.webhookUrl).toEqual(null);

    const updateSettingsResp = await metriportClient.updateSettings(TEST_WEBHOOK_URL);

    expect(updateSettingsResp.webhookUrl).toEqual(TEST_WEBHOOK_URL);

    await metriportClient.updateSettings("");
  });
});
