import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import { medicalApi } from "../shared";
import { getPingWebhookRequest } from "../webhook/settings";
import { checkWebhookRequestMeta } from "../webhook/shared";
import whServer from "../webhook/webhook-server";

dayjs.extend(isBetween);
dayjs.extend(duration);

const pingWebhookCheckMaxRetries = 5;
const pingWebhookCheckStatusWaitTime = dayjs.duration({ seconds: 2 });
const waitTimeBetweenUpdateAndWhCheck = dayjs.duration({ milliseconds: 500 });

const NANO_ID_LENGTH = 21;

export function runSettingsTests() {
  it("gets settings", async () => {
    const settings = await medicalApi.getSettings();
    expect(settings).toBeTruthy();
  });

  it("updates settings", async () => {
    const whUrl = whServer.getWebhookServerUrl();
    const updateResp = await medicalApi.updateSettings(whUrl);
    expect(updateResp).toBeTruthy();
    expect(updateResp.webhookUrl).toEqual(whUrl);
    expect(updateResp.webhookKey).toBeTruthy();
    whServer.storeWebhookKey(updateResp.webhookKey);
    const settings = await medicalApi.getSettings();
    expect(settings).toBeTruthy();
    expect(settings.webhookUrl).toBeTruthy();
    expect(settings.webhookUrl).toEqual(whUrl);
  });

  it("makes sure we were able to process ping WH", async () => {
    // Retry WH requests in case the WH arrived before we were able to process/store the webhookkey
    // This would make the WH request fail b/c we need the key to verify the signature
    await medicalApi.retryWebhookRequests();
    await sleep(waitTimeBetweenUpdateAndWhCheck.asMilliseconds());
    expect(true).toBeTruthy();
  });

  it("receives ping WH request", async () => {
    let retryLimit = 0;
    let whRequest = getPingWebhookRequest();
    while (!whRequest) {
      if (retryLimit++ > pingWebhookCheckMaxRetries) {
        console.log(`Gave up waiting for ping WH request`);
        break;
      }
      console.log(
        `Waiting for ping, retrying in ${pingWebhookCheckStatusWaitTime.asSeconds()} seconds...`
      );
      await sleep(pingWebhookCheckStatusWaitTime.asMilliseconds());
      whRequest = getPingWebhookRequest();
    }
    expect(whRequest).toBeTruthy();
  });

  it("receives ping WH with correct data", async () => {
    const whRequest = getPingWebhookRequest();
    checkWebhookRequestMeta(whRequest, "ping");
    if (!whRequest) throw new Error("Missing WH request");
    expect(whRequest.ping).toBeTruthy();
    expect(whRequest.ping.length).toEqual(NANO_ID_LENGTH);
  });
}
