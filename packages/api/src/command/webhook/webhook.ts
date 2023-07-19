import { MetriportData } from "@metriport/api-sdk/devices/models/metriport-data";
import Axios from "axios";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import WebhookError from "../../errors/webhook";
import { DataType } from "../../mappings/garmin";
import { Settings, WEBHOOK_STATUS_OK } from "../../models/settings";
import { WebhookRequest } from "../../models/webhook-request";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { updateWebhookStatus } from "../settings/updateSettings";
import { isDAPIWebhookRequest } from "./devices";
import { updateWebhookRequestStatus } from "./webhook-request";

const axios = Axios.create();

const log = Util.log(`Webhook`);

// General
type WebhookPingPayload = {
  ping: string;
};

// TODO move to DAPI specific file: devices.ts
// DAPI
export type WebhookUserDataPayload = {
  [k in DataType]?: MetriportData[];
};
export type WebhookMetadataPayload = { messageId: string; when: string };

export const processRequest = async (
  webhookRequest: WebhookRequest,
  settings: Settings
): Promise<boolean> => {
  const payload = webhookRequest.payload;

  const { webhookUrl, webhookKey, webhookEnabled } = settings;
  if (!webhookUrl || !webhookKey) {
    const msg =
      `Missing webhook config, skipping sending it ` +
      `(url: ${webhookUrl}, key: ${webhookKey ? "<defined>" : null}`;
    console.log(msg);
    capture.message(msg, { extra: { context: `webhook.processRequest` } });
    // if this is for DAPI:
    //    mark this request as failed on the DB - so it can be retried later
    // if this is for MAPI:
    //    silently ignore this since this is just a notification for ease-of-use
    //    and won't result in data loss
    if (isDAPIWebhookRequest(webhookRequest)) {
      await updateWebhookRequestStatus({
        id: webhookRequest.id,
        status: "failure",
      });
      return false;
    } else {
      return true;
    }
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
          type: webhookRequest.type,
        },
        ...(payload as any), //eslint-disable-line @typescript-eslint/no-explicit-any
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
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    capture.error(err, {
      extra: {
        webhookRequestId: webhookRequest.id,
        webhookUrl,
        context: `webhook.processRequest`,
        cause: err.cause,
      },
    });
    try {
      // mark this request as failed on the DB
      await updateWebhookRequestStatus({
        id: webhookRequest.id,
        status: "failure",
      });
    } catch (err2) {
      console.log(`Failed to store failure state on WH log`, err2);
      capture.error(err2, {
        extra: {
          webhookRequestId: webhookRequest.id,
          webhookUrl,
          context: `webhook.processRequest.updateStatus.failed`,
        },
      });
    }
    let webhookStatusDetail;
    if (err instanceof WebhookError) {
      webhookStatusDetail = err.cause.message;
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
      capture.error(err2, {
        extra: {
          webhookRequestId: webhookRequest.id,
          webhookUrl,
          context: `webhook.processRequest.updateStatus.details`,
        },
      });
    }
  }
  return false;
};

export const sendPayload = async (
  payload: unknown,
  url: string,
  apiKey: string,
  timeout = 5_000
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // Don't change this error message, it's used to detect if the webhook is working or not
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
