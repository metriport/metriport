import { MetriportData } from "@metriport/api/lib/models/metriport-data";
import Axios from "axios";
import { chunk, groupBy } from "lodash";
import { getUserTokenByUAT } from "./command/cx-user/get-user-token";
import { getSettingsOrFail } from "./command/settings/getSettings";
import { updateWebhookStatus } from "./command/settings/updateSettings";
import { getErrorMessage } from "./errors";
import WebhookError from "./errors/webhook";
import { DataType, TypedData, UserData } from "./mappings/garmin";
import { Settings, WEBHOOK_STATUS_OK } from "./models/settings";
import { Util } from "./shared/util";

const axios = Axios.create();

const log = Util.log(`GARMIN.Webhook`);

type WebhookPayloadType = DataType | "ping";

type WebhookPayload = {
  [k in WebhookPayloadType]?: MetriportData[];
};

export const processData = async <T extends MetriportData>(
  data: UserData<T>[]
): Promise<void> => {
  // TOO move to Promise.allSettled?
  // the same Garmin user/UAT might be associated with multiple Metriport Customers
  const dataWithCustomerIdList = await Promise.all(
    data.map(async (d) => {
      const uat = d.user.userAccessToken;
      const userTokens = await getUserTokenByUAT({
        oauthUserAccessToken: uat,
      });
      const cxIdList = userTokens.map((t) => t.cxId);
      if (cxIdList.length < 1) {
        log(`Could not find account for UAT ${uat}`);
      }
      return { data: d.typedData, cxIdList };
    })
  );
  // Flatten the list so each item has one cxId and one data record
  const dataWithSingleCxId = dataWithCustomerIdList.flatMap((v) =>
    v.cxIdList.map((cxId) => ({ cxId, data: v.data }))
  );
  // Group all the data records for the same cxId
  const dataGroupedByCxId = groupBy(dataWithSingleCxId, (v) => v.cxId);
  // Process all data for the same Customer in one Promise, run all in parallel
  await Promise.allSettled(
    Object.keys(dataGroupedByCxId).map(async (cxId) => {
      try {
        const dataList = dataGroupedByCxId[cxId].map((data) => data.data);
        const settings = await getSettingsOrFail({ id: cxId });
        await processOneCustomer(settings, dataList);
      } catch (err) {
        const msg = getErrorMessage(err);
        log(`Failed to process data of customer ${cxId}: ${msg}`);
      }
    })
  );
};

const processOneCustomer = async <T extends MetriportData>(
  settings: Settings,
  dataList: TypedData<T>[]
): Promise<boolean> => {
  const dataByType = groupBy(dataList, (d) => d.type);
  for (const type of Object.keys(dataByType) as DataType[]) {
    const dataOfType = dataByType[type];

    // CHECK IF THERE ARE FAILED CHUNKS FROM PREVIOUS ATTEMPTS AND START WITH THOSE
    // TODO #34 depends on #150 to make table available

    const chunksOfData = chunk(dataOfType, 100);

    for (const chunk of chunksOfData) {
      const payload: WebhookPayload = {
        [type]: chunk.map((c) => c.data),
      };

      const success = await processChunk(payload, settings);

      if (success) {
        // give it some time to prevent flooding the customer
        await Util.sleep(Math.random() * 200);
      }
    }
  }
  return true;
};

const processChunk = async (
  payload: WebhookPayload,
  settings: Settings
): Promise<boolean> => {
  // STORE ON THE DB
  // TODO #34 depends on #150 to make table available

  const url = settings.webhookUrl;
  const key = settings.webhookKey;
  const webhookStatus = settings.webhookStatus;

  if (!url || !key) {
    console.log(
      `Missing webhook config, skipping sending it ` +
      `(url: ${url}, key: ${key ? "<defined>" : null}`
    );
    return false;
  }

  // SEND TO CUSTOMER
  log(
    `Sending payload (settings ${settings.id}): ${JSON.stringify(
      payload,
      undefined,
      2
    )}`
  );
  await sendPayload(payload, url, key);

  // UPDATE THE DB WITH STATUS OF SENDING RECORDS
  // TODO #34 depends on #150 to make table available

  if (!webhookStatus || webhookStatus !== WEBHOOK_STATUS_OK) {
    // update the status to successful since we were able to send the payload
    await updateWebhookStatus({
      id: settings.id,
      webhookStatus: WEBHOOK_STATUS_OK,
    });
  }

  return true;
};

const sendPayload = async (
  payload: WebhookPayload,
  url: string,
  apiKey: string,
  timeout = 2_000
): Promise<boolean> => {
  try {
    await axios.post(url, JSON.stringify(payload), {
      headers: {
<<<<<<< HEAD
        "x-webhook-key": apiKey,
=======
        "webhook-key": apiKey,
>>>>>>> 32fdddb (Add webhook edit and status)
        "user-agent": "Metriport API",
      },
      timeout,
    });
    return true;
  } catch (err: any) {
    throw new WebhookError(`Failed to send payload`, err);
  }
};

export const sendTestPayload = async (
  url: string,
  key: string
): Promise<boolean> => {
  const payload: WebhookPayload = {
    ping: [],
  };
  return sendPayload(payload, url, key, 2_000);
};
