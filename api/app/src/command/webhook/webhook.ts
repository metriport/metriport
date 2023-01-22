import { MetriportData } from "@metriport/api/lib/models/metriport-data";
import Axios from "axios";
import dayjs from "dayjs";
import { chunk, groupBy } from "lodash";
import { nanoid } from "nanoid";

import { AppleWebhookPayload } from "../../mappings/apple";
import { getErrorMessage } from "../../errors";
import WebhookError from "../../errors/webhook";
import { DataType, TypedData, UserData } from "../../mappings/garmin";
import { Settings, WEBHOOK_STATUS_OK } from "../../models/settings";
import { WebhookRequest } from "../../models/webhook-request";
import { Util } from "../../shared/util";
import { getConnectedUsers, getConnectedUserOrFail } from "../connected-user/get-connected-user";
import { getUserTokenByUAT } from "../cx-user/get-user-token";
import { getSettingsOrFail } from "../settings/getSettings";
import { updateWebhookStatus } from "../settings/updateSettings";
import { reportUsage as reportUsageCmd } from "../usage/report-usage";
import { createWebhookRequest, updateWebhookRequestStatus } from "../webhook/webhook-request";

const axios = Axios.create();

const log = Util.log(`Webhook`);

type WebhookUserDataPayload = {
  [k in DataType]?: MetriportData[];
};
type WebhookUserPayload = { userId: string } & WebhookUserDataPayload;
type WebhookMetadataPayload = { messageId: string; when: string };
type WebhookDataPayload = {
  meta: WebhookMetadataPayload;
  users: WebhookUserPayload[];
};
type WebhookDataPayloadWithoutMessageId = Omit<WebhookDataPayload, "meta">;
type WebhookPingPayload = {
  ping: string;
};
type WebhookPayload = WebhookDataPayload | WebhookPingPayload;

// TODO #163 - break this up, it has Garmin-specific logic that should live on its own file
/**
 * Does the bulk of processing webhook incoming data, including storing and sending
 * to Customers/accounts.
 *
 * @param {UserData} data The data coming from a Provider, already converted to our internal format
 */
export const processData = async <T extends MetriportData>(data: UserData<T>[]): Promise<void> => {
  try {
    // the same Garmin user/UAT might be associated with multiple Metriport Customers
    // convert "data + UAT" into "data + list of users/customers"
    const dataWithListOfCxIdAndUserId = await Promise.all(
      data.map(async d => {
        const uat = d.user.userAccessToken;
        const userTokens = await getUserTokenByUAT({
          oauthUserAccessToken: uat,
        });
        const connectedUsers = (
          await Promise.all(
            userTokens.map(async ut => {
              return getConnectedUsers({
                cxId: ut.cxId,
                ids: [ut.userId],
              });
            })
          )
        ).flatMap(u => u);
        const cxIdAndUserIdList = connectedUsers.map(t => ({
          cxId: t.cxId,
          cxUserId: t.cxUserId,
        }));
        if (cxIdAndUserIdList.length < 1) {
          log(`Could not find account for UAT ${uat}`);
        }
        return { typedData: d.typedData, cxIdAndUserIdList };
      })
    );
    // Flatten the list so each item has one cxId/userId and one data record
    const dataByUser = dataWithListOfCxIdAndUserId.flatMap(v =>
      v.cxIdAndUserIdList.map(({ cxId, cxUserId }) => ({
        cxId,
        cxUserId,
        typedData: v.typedData,
      }))
    );
    // Group all the data records for the same cxId
    const dataByCustomer = groupBy(dataByUser, v => v.cxId);
    // Process all data for the same Customer in one Promise, run all in parallel
    await Promise.allSettled(
      Object.keys(dataByCustomer).map(async cxId => {
        try {
          // flat list of each data record and its respective user
          const dataAndUserList = dataByCustomer[cxId].map(v => ({
            cxUserId: v.cxUserId,
            typedData: v.typedData,
          }));
          // split the list in chunks
          const chunks = chunk(dataAndUserList, 10);
          // transform each chunk into a payload
          const payloads = chunks.map(c => {
            // groups by user
            const dataByUser = groupBy(dataAndUserList, v => v.cxUserId);
            // now convert that into an array of WebhookUserPayload (all the data of a user for this chunk)
            const users: WebhookUserPayload[] = [];
            for (const cxUserId of Object.keys(dataByUser)) {
              const usersData = dataByUser[cxUserId].map(dbu => dbu.typedData);
              // for each user, group together data by type
              const usersDataByType = groupBy(usersData, ud => ud.type);
              const data: MetriportData[] = [];
              for (const type of Object.keys(usersDataByType)) {
                const dataOfType: TypedData<MetriportData>[] = usersDataByType[type];
                data.push(...dataOfType.map(d => d.data));
                users.push({
                  userId: cxUserId,
                  [type]: data,
                });
              }
            }
            const payload: WebhookDataPayloadWithoutMessageId = { users };
            return payload;
          });
          // now that we have a all the chunks for one customer, process them
          const settings = await getSettingsOrFail({ id: cxId });
          await processOneCustomer(cxId, settings, payloads);
          await reportUsage(
            cxId,
            dataAndUserList.map(du => du.cxUserId)
          );
        } catch (err) {
          const msg = getErrorMessage(err);
          log(`Failed to process data of customer ${cxId}: ${msg}`);
        }
      })
    );
  } catch (err) {
    log(`Error on processData: `, err);
  }
};

export const processAppleData = async (
  data: AppleWebhookPayload,
  metriportUserId: string,
  cxId: string
): Promise<void> => {
  try {
    const connectedUser = await getConnectedUserOrFail({ id: metriportUserId, cxId });

    const settings = await getSettingsOrFail({ id: connectedUser!.cxId });
    await processOneCustomer(connectedUser!.cxId, settings, [
      { users: [{ userId: metriportUserId, ...data }] },
    ]);
    await reportUsage(connectedUser!.cxId, [connectedUser!.cxUserId]);
  } catch (err) {
    log(`Error on processAppleData: `, err);
  }
};

const reportUsage = async (cxId: string, cxUserIds: string[]): Promise<void> => {
  cxUserIds.forEach(cxUserId => [
    reportUsageCmd({ cxId, cxUserId }).catch(err => {
      // TODO #156 report to monitoring app instead
      log(`Failed to report usage, cxId ${cxId}, cxUserId ${cxUserId}`, err);
    }),
  ]);
};

// const processOneCustomer = async <T extends MetriportData>(
const processOneCustomer = async (
  cxId: string,
  settings: Settings,
  payloads: WebhookDataPayloadWithoutMessageId[]
): Promise<boolean> => {
  for (const payload of payloads) {
    // create a representation of this request and store on the DB
    const webhookRequest = await createWebhookRequest({ cxId, payload });
    // send it to the customer and update the request status
    const success = await processRequest(webhookRequest, settings);
    // give it some time to prevent flooding the customer
    if (success) await Util.sleep(Math.random() * 200);
  }
  return true;
};

export const processRequest = async (
  webhookRequest: WebhookRequest,
  settings: Settings
): Promise<boolean> => {
  const payload: any = webhookRequest.payload as any;

  const { webhookUrl, webhookKey, webhookEnabled } = settings;
  if (!webhookUrl || !webhookKey) {
    console.log(
      `Missing webhook config, skipping sending it ` +
        `(url: ${webhookUrl}, key: ${webhookKey ? "<defined>" : null}`
    );
    // mark this request as failed on the DB - so it can be retried later
    await updateWebhookRequestStatus({
      id: webhookRequest.id,
      status: "failure",
    });
    return false;
  }
  // TODO Separate preparing the payloads with the actual sending of that data over the wire
  // It will simplify managing the webhook status (enabled?) and only retrying sending once
  // every X minutes
  try {
    await sendPayload(
      {
        meta: {
          messageId: webhookRequest.id,
          when: dayjs(webhookRequest.createdAt).toISOString(),
        },
        ...payload,
      },
      webhookUrl,
      webhookKey
    );
    // mark this request as successful on the DB
    await updateWebhookRequestStatus({
      id: webhookRequest.id,
      status: "success",
    });

    // if the webhook was not working before, update the status to successful since we were able to send the payload
    if (!webhookEnabled) {
      await updateWebhookStatus({
        id: settings.id,
        webhookEnabled: true,
        webhookStatusDetail: WEBHOOK_STATUS_OK,
      });
    }
    return true;
  } catch (err: any) {
    try {
      // mark this request as failed on the DB
      await updateWebhookRequestStatus({
        id: webhookRequest.id,
        status: "failure",
      });
    } catch (err2) {
      console.log(`Failed to store failure state on WH log`, err2);
    }
    let webhookStatusDetail;
    if (err instanceof WebhookError) {
      webhookStatusDetail = err.underlyingError.message;
    } else {
      log(`Unexpected error testing webhook`, err);
      webhookStatusDetail = `Internal error: ${err?.message}`;
    }
    try {
      // update the status of this webhook on the DB
      await updateWebhookStatus({
        id: settings.id,
        webhookEnabled: false,
        webhookStatusDetail,
      });
    } catch (err2) {
      console.log(`Failed to store failure state on WH settings`, err2);
    }
  }
  return false;
};

const sendPayload = async (
  payload: unknown,
  url: string,
  apiKey: string,
  timeout = 5_000
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

export const sendTestPayload = async (url: string, key: string): Promise<boolean> => {
  const ping = nanoid();
  const payload: WebhookPingPayload = {
    ping,
  };
  const res = await sendPayload(payload, url, key, 2_000);
  if (res.pong && res.pong === ping) return true;
  return false;
};
