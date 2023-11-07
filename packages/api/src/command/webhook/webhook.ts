import Axios from "axios";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { Product } from "../../domain/product";
import WebhookError from "../../errors/webhook";
import { Settings, WEBHOOK_STATUS_OK } from "../../models/settings";
import { WebhookRequest } from "../../models/webhook-request";
import { analytics, EventTypes } from "../../shared/analytics";
import { errorToString } from "../../shared/log";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { updateWebhookStatus } from "../settings/updateSettings";
import { isDAPIWebhookRequest } from "./devices-util";
import { updateWebhookRequestStatus } from "./webhook-request";

const DEFAULT_TIMEOUT_SEND_PAYLOAD_MS = 5_000;
const DEFAULT_TIMEOUT_SEND_TEST_MS = 2_000;
const axios = Axios.create();
const log = Util.log(`Webhook`);

// General
type WebhookPingPayload = {
  ping: string;
};

/**
 * @param {messageId}  - The ID of the webhook request
 * @param {when}  - The date and time when the webhook request was created
 * @param {type}  - The type of the webhook request, either document-download or consolidated-request
 * @param {data}  - Any data the customer pases to the webhook request
 */
export type WebhookMetadataPayload = {
  messageId: string;
  when: string;
  type: string;
  data?: unknown;
};

async function missingWHSettings(
  webhookRequest: WebhookRequest,
  webhookUrl: string | null,
  webhookKey: string | null
): Promise<boolean> {
  const product = getProductFromWebhookRequest(webhookRequest);
  const msg = `[${product}] Missing webhook config, skipping sending it`;
  const loggableKey = webhookKey ? "<defined>" : "<not-defined>";
  log(msg + ` (url: ${webhookUrl}, key: ${loggableKey}`);
  capture.message(msg, {
    extra: {
      webhookRequestId: webhookRequest.id,
      webhookUrl,
      webhookKey: loggableKey,
      context: `webhook.processRequest`,
    },
    level: "info",
  });
  await updateWebhookRequestStatus({
    id: webhookRequest.id,
    status: "failure",
  });
  return false;
}

function getProductFromWebhookRequest(webhookRequest: WebhookRequest): Product {
  if (isDAPIWebhookRequest(webhookRequest)) {
    return Product.devices;
  } else {
    return Product.medical;
  }
}

export const processRequest = async (
  webhookRequest: WebhookRequest,
  settings: Settings,
  additionalWHRequestMeta?: Record<string, string>,
  cxWHRequestMeta?: unknown
): Promise<boolean> => {
  const { webhookUrl, webhookKey, webhookEnabled } = settings;
  if (!webhookUrl || !webhookKey) {
    return missingWHSettings(webhookRequest, webhookUrl, webhookKey);
  }
  const sendAnalytics = (status: string) => {
    analytics({
      distinctId: webhookRequest.cxId,
      event: EventTypes.webhook,
      properties: {
        apiType: getProductFromWebhookRequest(webhookRequest),
        whType: webhookRequest.type,
        whStatus: status,
        ...(additionalWHRequestMeta ? additionalWHRequestMeta : {}),
      },
    });
  };

  const payload = webhookRequest.payload;
  try {
    const meta: WebhookMetadataPayload = {
      messageId: webhookRequest.id,
      when: dayjs(webhookRequest.createdAt).toISOString(),
      type: webhookRequest.type,
      data: cxWHRequestMeta,
    };
    await sendPayload(
      {
        meta,
        ...payload,
      },
      webhookUrl,
      webhookKey
    );
    // mark this request as successful on the DB
    const status = "success";
    await updateWebhookRequestStatus({
      id: webhookRequest.id,
      status,
    });

    // if the webhook was not working before, update the status to successful since we were able to send the payload
    if (!webhookEnabled) {
      await updateWebhookStatus({
        id: settings.id,
        webhookEnabled: true,
        webhookStatusDetail: WEBHOOK_STATUS_OK,
      });
    }
    sendAnalytics(status);
    return true;

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.log(`Failed to process WH request: ${errorToString(error)}`);
    capture.error(error, {
      extra: {
        webhookRequestId: webhookRequest.id,
        webhookUrl,
        context: `webhook.processRequest`,
        error,
      },
    });
    const status = "failure";
    try {
      // mark this request as failed on the DB
      await updateWebhookRequestStatus({
        id: webhookRequest.id,
        status,
      });
    } catch (err2) {
      console.log(`Failed to store failure state on WH log: ${errorToString(err2)}`);
      capture.error(err2, {
        extra: {
          webhookRequestId: webhookRequest.id,
          webhookUrl,
          context: `webhook.processRequest.updateStatus.failed`,
          error: err2,
        },
      });
    }
    sendAnalytics(status);
    let webhookStatusDetail;
    if (error instanceof WebhookError) {
      webhookStatusDetail = String(error.cause);
    } else {
      log(`Unexpected error testing webhook`, error);
      webhookStatusDetail = `Internal error: ${error.message}`;
    }
    try {
      // update the status of this webhook on the DB
      await updateWebhookStatus({
        id: settings.id,
        webhookEnabled: false,
        webhookStatusDetail,
      });
    } catch (err2) {
      log(`Failed to store failure state on WH settings: ${errorToString(err2)}`);
      capture.error(err2, {
        extra: {
          webhookRequestId: webhookRequest.id,
          webhookUrl,
          context: `webhook.processRequest.updateStatus.details`,
          error: err2,
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
  timeout = DEFAULT_TIMEOUT_SEND_PAYLOAD_MS
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
  try {
    const res = await axios.post(url, payload, {
      headers: {
        "x-webhook-key": apiKey,
        "user-agent": "Metriport API",
      },
      timeout,
      maxRedirects: 0, // disable redirects to prevent SSRF
    });
    return res.data;
  } catch (err) {
    // Don't change this error message, it's used to detect if the webhook is working or not
    throw new WebhookError(`Failed to send payload`, err);
  }
};

export const sendTestPayload = async (url: string, key: string): Promise<boolean> => {
  const ping = nanoid();
  const payload: WebhookPingPayload = {
    ping,
  };
  const res = await sendPayload(payload, url, key, DEFAULT_TIMEOUT_SEND_TEST_MS);
  if (res.pong && res.pong === ping) return true;
  return false;
};

export const isWebhookDisabled = (meta?: unknown): boolean => {
  if (!meta) return false;
  console.log(meta);
  return Boolean((meta as { disableWHFlag?: string })?.disableWHFlag);
};
