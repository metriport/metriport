import { MetriportData } from "@metriport/api/lib/models/metriport-data";
import Axios from "axios";
import { chunk, groupBy } from "lodash";
import { nanoid } from "nanoid";
import { getErrorMessage } from "../../errors";
import WebhookError from "../../errors/webhook";
import { DataType, UserData } from "../../mappings/garmin";
import { Settings, WEBHOOK_STATUS_OK } from "../../models/settings";
import { Util } from "../../shared/util";
import { getUserTokenByUAT } from "../cx-user/get-user-token";
import { getSettingsOrFail } from "../settings/getSettings";
import { updateWebhookStatus } from "../settings/updateSettings";
import {
  createWebhookRequest,
  updateWebhookRequestStatus,
} from "../webhook/webhook-request";

const axios = Axios.create();

const log = Util.log(`Webhook`);

type WebhookUserPayload = {
  [k in DataType]?: MetriportData[];
};
type WebhookDataPayload = {
  [k: string]: WebhookUserPayload;
};
type WebhookPingPayload = {
  ping: string;
};
type WebhookPayload = WebhookDataPayload | WebhookPingPayload;

//TODO #43 test this out
/**
 * Does the bulk of processing webhook incoming data, including storing and sending
 * to Customers/accounts.
 *
 * @param {UserData} data The data coming from a Provider, already converted to our internal format
 */
export const processData = async <T extends MetriportData>(
  data: UserData<T>[]
): Promise<void> => {
  // the same Garmin user/UAT might be associated with multiple Metriport Customers
  // convert "data + UAT" into "data + list of users/customers"
  const dataWithListOfCxIdAndUserId = await Promise.all(
    data.map(async (d) => {
      const uat = d.user.userAccessToken;
      const userTokens = await getUserTokenByUAT({
        oauthUserAccessToken: uat,
      });
      const cxIdAndUserIdList = userTokens.map((t) => ({
        cxId: t.cxId,
        userId: t.userId,
      }));
      if (cxIdAndUserIdList.length < 1) {
        log(`Could not find account for UAT ${uat}`);
      }
      return { data: d.typedData, cxIdAndUserIdList };
    })
  );
  // Flatten the list so each item has one cxId/userId and one data record
  const dataByUser = dataWithListOfCxIdAndUserId.flatMap((v) =>
    v.cxIdAndUserIdList.map(({ cxId, userId }) => ({
      cxId,
      userId,
      data: v.data,
    }))
  );
  // Group all the data records for the same cxId
  const dataByCustomer = groupBy(dataByUser, (v) => v.cxId);
  // Process all data for the same Customer in one Promise, run all in parallel
  await Promise.allSettled(
    Object.keys(dataByCustomer).map(async (cxId) => {
      try {
        // flat list of each data record and its respective user
        const dataAndUserList = dataByCustomer[cxId].map((v) => ({
          userId: v.userId,
          data: v.data,
        }));
        // split the list in chunks
        const chunks = chunk(dataAndUserList, 100);
        // transform each chunk into a payload
        const payloads = chunks.map((c) => {
          // groups by user
          const dataByUser = groupBy(dataAndUserList, (v) => v.userId);
          // now convert that into a WebhookDataPayload, each property a user, each user a dictionary of data type and the respective data
          const payload: WebhookDataPayload = {};
          for (const userId of Object.keys(dataByUser)) {
            payload[userId] = groupBy(dataByUser[userId], (v) => v.data.type);
          }
          return payload;
        });

        // // now grouped by user
        // const dataByUser = groupBy(dataAndUserList, (v) => v.userId);
        // // now convert that into a WebhookDataPayload, each property a user, each user a dictionary of data type and the respective data
        // const payload: WebhookDataPayload = {};
        // for (const userId of Object.keys(dataByUser)) {
        //   payload[userId] = groupBy(dataByUser[userId], (v) => v.data.type);
        // }
        const settings = await getSettingsOrFail({ id: cxId });
        await processOneCustomer(cxId, settings, payloads);
      } catch (err) {
        const msg = getErrorMessage(err);
        log(`Failed to process data of customer ${cxId}: ${msg}`);
      }
    })
  );
};

// const processOneCustomer = async <T extends MetriportData>(
const processOneCustomer = async (
  cxId: string,
  settings: Settings,
  payloads: WebhookDataPayload[]
): Promise<boolean> => {
  // const dataByType = groupBy(dataList, (d) => d.type);
  // for (const type of Object.keys(dataByType) as DataType[]) {
  //   const dataOfType = dataByType[type];

  // CHECK IF THERE ARE FAILED CHUNKS FROM PREVIOUS ATTEMPTS AND START WITH THOSE

  // const chunksOfData = chunk(dataOfType, 100);

  // for (const chunk of chunksOfData) {
  //   const payload: WebhookUserPayload = {
  //     [type]: chunk.map((c) => c.data),
  //   };
  for (const payload of payloads) {
    const success = await processChunk(cxId, payload, settings);
    // give it some time to prevent flooding the customer
    if (success) await Util.sleep(Math.random() * 200);
  }
  // }
  // }
  return true;
};

const processChunk = async (
  cxId: string,
  payload: WebhookPayload,
  settings: Settings
): Promise<boolean> => {
  // STORE ON THE DB
  const webhookRequest = await createWebhookRequest({ cxId, payload });

  const { webhookUrl, webhookKey, webhookEnabled } = settings;

  if (!webhookUrl || !webhookKey) {
    console.log(
      `Missing webhook config, skipping sending it ` +
        `(url: ${webhookUrl}, key: ${webhookKey ? "<defined>" : null}`
    );
    return false;
  }

  try {
    // SEND TO CUSTOMER
    log(
      `Sending payload (settings ${settings.id}): ${JSON.stringify(
        payload,
        undefined,
        2
      )}`
    );
    await sendPayload(payload, webhookUrl, webhookKey);

    await updateWebhookRequestStatus({
      id: webhookRequest.id,
      status: "success",
    });

    // if the web
    if (!webhookEnabled) {
      // update the status to successful since we were able to send the payload
      await updateWebhookStatus({
        id: settings.id,
        webhookEnabled: true,
        webhookStatusDetail: WEBHOOK_STATUS_OK,
      });
    }
    return true;
  } catch (err: any) {
    try {
      await updateWebhookRequestStatus({
        id: webhookRequest.id,
        status: "failure",
      });
    } catch (err2) {
      console.log(`Failed to store failure state on WH log`, err);
    }
    let webhookStatusDetail;
    if (err instanceof WebhookError) {
      webhookStatusDetail = err.underlyingError.message;
    } else {
      log(`Unexpected error testing webhook`, err);
      webhookStatusDetail = `Internal error: ${err?.message}`;
    }
    try {
      await updateWebhookStatus({
        id: settings.id,
        webhookEnabled: false,
        webhookStatusDetail,
      });
    } catch (err2) {
      console.log(`Failed to store failure state on WH settings`, err);
    }
  }
  return false;
};

const sendPayload = async (
  payload: WebhookPayload,
  url: string,
  apiKey: string,
  timeout = 2_000
): Promise<any> => {
  try {
    const res = await axios.post(url, payload, {
      headers: {
        "x-webhook-key": apiKey,
        "user-agent": "Metriport API",
      },
      timeout,
    });
    return res.data;
  } catch (err: any) {
    throw new WebhookError(`Failed to send payload`, err);
  }
};

export const sendTestPayload = async (
  url: string,
  key: string
): Promise<boolean> => {
  const ping = nanoid();
  const payload: WebhookPingPayload = {
    ping,
  };
  const res = await sendPayload(payload, url, key, 2_000);
  if (res.pong && res.pong === ping) return true;
  return false;
};
