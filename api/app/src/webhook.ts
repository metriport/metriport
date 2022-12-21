import Axios from "axios";
import { chunk, groupBy } from "lodash";
import { getUserTokenByUAT } from "./command/cx-user/get-user-token";
import { getSettingsOrFail } from "./command/settings/getSettings";
import { getErrorMessage } from "./errors";
import { DataType, TypedData, UserData } from "./mappings/garmin";
import { Settings } from "./models/settings";
import { Util } from "./shared/util";

const axios = Axios.create();

const log = Util.log(`GARMIN.Webhook`);

interface WebhookPayload<T> {
  [k: string]: T[];
}

export const processData = async <T>(data: UserData<T>[]): Promise<void> => {
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

const processOneCustomer = async <T>(
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
      const payload = { [type]: chunk.map((c) => c.data) };

      const success = await processChunk(payload, settings);

      if (success) {
        // give it some time to prevent flooding the customer
        await Util.sleep(Math.random() * 200);
      }
    }
  }
  return true;
};

const processChunk = async <T>(
  payload: WebhookPayload<T>,
  settings: Settings
): Promise<boolean> => {
  // STORE ON THE DB
  // TODO #34 depends on #150 to make table available

  const url = settings.webhookUrl;
  // TODO #150 Get this from the DB
  // const key = settings.webhookKey;
  const key = "bogus";

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
  await sendChunk(payload, url, key);

  // UPDATE THE DB WITH STATUS OF SENDING RECORDS
  // TODO #34 depends on #150 to make table available

  return true;
};

const sendChunk = async <T>(
  payload: WebhookPayload<T>,
  url: string,
  apiKey: string
): Promise<boolean> => {
  await axios.post(url, JSON.stringify(payload), {
    headers: {
      "webhook-key": apiKey,
      "user-agent": "Metriport API",
    },
    timeout: 5_000,
  });
  return true;
};

// TODO #34 Find a way to authenticate our calls to our customer's webhook
const getCustomerApiKey = async (customerId: string): Promise<string> => {
  return `bogus`;
};
