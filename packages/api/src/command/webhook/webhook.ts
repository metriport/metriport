import { webhookDisableFlagName } from "@metriport/core/domain/webhook/index";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, isTrue } from "@metriport/shared";
import Axios from "axios";
import crypto from "crypto";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { v4 as uuidv4 } from "uuid";
import { z, ZodError } from "zod";
import { Product } from "../../domain/product";
import { WebhookRequestStatus } from "../../domain/webhook";
import WebhookError from "../../errors/webhook";
import { isWebhookPongDisabledForCx } from "../../external/aws/app-config";
import { Settings, WEBHOOK_STATUS_OK } from "../../models/settings";
import { WebhookRequest } from "../../models/webhook-request";
import { getHttpStatusFromAxiosError } from "../../shared/http";
import { updateWebhookStatus } from "../settings/updateSettings";
import { isDAPIWebhookRequest } from "./devices-util";
import { updateWebhookRequest, WebhookRequestData } from "./webhook-request";

const DEFAULT_TIMEOUT_SEND_PAYLOAD_MS = 5_000;
const DEFAULT_TIMEOUT_SEND_TEST_MS = 2_000;

const successfulStatusDetail = "OK";

const axios = Axios.create({
  transitional: {
    // enables ETIMEDOUT instead of ECONNABORTED for timeouts - https://betterstack.com/community/guides/scaling-nodejs/nodejs-errors/
    clarifyTimeoutError: true,
  },
});
const { log } = out(`Webhook`);

// General
type WebhookPingPayload = {
  ping: string;
  meta: WebhookMetadataPayload;
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
  webhookRequest: WebhookRequest | WebhookRequestData,
  webhookUrl: string | null,
  webhookKey: string | null
): Promise<boolean> {
  const product = getProductFromWebhookRequest(webhookRequest);
  const msg = `[${product}] Missing webhook config, skipping sending it, WH req ID ${webhookRequest.id}`;
  const loggableKey = webhookKey ? "<defined>" : "<not-defined>";
  log(msg + ` (url: ${webhookUrl}, key: ${loggableKey}`);
  // mark this WH request as failed
  await updateWebhookRequest({
    id: webhookRequest.id,
    status: "failure",
  });
  return false;
}

function getProductFromWebhookRequest(
  webhookRequest: WebhookRequest | WebhookRequestData
): Product {
  if (isDAPIWebhookRequest(webhookRequest)) {
    return Product.devices; // TODO: 1411 - remove when DAPI is fully discontinued
  } else {
    return Product.medical;
  }
}

export async function processRequest(
  webhookRequest: WebhookRequest | WebhookRequestData,
  settings: Settings,
  additionalWHRequestMeta?: Record<string, string>,
  cxWHRequestMeta?: unknown
): Promise<boolean> {
  const sendAnalytics = (status: string, properties?: Record<string, string>) => {
    analytics({
      distinctId: webhookRequest.cxId,
      event: EventTypes.webhook,
      properties: {
        whType: webhookRequest.type,
        whStatus: status,
        ...(additionalWHRequestMeta ? additionalWHRequestMeta : {}),
        ...(properties ? properties : {}),
      },
    });
  };

  const { webhookUrl, webhookKey, webhookEnabled } = settings;
  if (!webhookUrl || !webhookKey) {
    sendAnalytics("failure", { reason: "missing-webhook-settings" });
    return missingWHSettings(webhookRequest, webhookUrl, webhookKey);
  }
  const productType = getProductFromWebhookRequest(webhookRequest);

  const payload = webhookRequest.payload;
  try {
    const meta: WebhookMetadataPayload = {
      messageId: webhookRequest.id,
      when: dayjs(webhookRequest.createdAt).toISOString(),
      type: webhookRequest.type,
      data: cxWHRequestMeta,
    };

    const sendResponse = await sendPayload(
      {
        meta,
        ...payload,
      },
      webhookUrl,
      webhookKey
    );

    // TODO: 1411 - remove when DAPI is fully discontinued
    if (productType === Product.medical) {
      // mark this request as successful on the DB
      const status = "success";
      await updateWebhookRequest({
        id: webhookRequest.id,
        status,
        statusDetail: successfulStatusDetail,
        durationMillis: sendResponse.durationMillis,
        httpStatus: sendResponse.status,
        requestUrl: sendResponse.url,
      });

      // if the webhook was not working before, update the status to successful since we were able to send the payload
      if (!webhookEnabled) {
        await updateWebhookStatus({
          cxId: settings.id,
          webhookEnabled: true,
          webhookStatusDetail: WEBHOOK_STATUS_OK,
        });
      }
      sendAnalytics(status);
    }
    return true;
  } catch (error) {
    // TODO: 1411 - remove the conditional and keep the code inside it when DAPI is fully discontinued
    if (productType === Product.medical) {
      log(`Failed to process WH request: ${errorToString(error)}`);
      const status = "failure";
      await Promise.all([
        updateWhRequestWithError(error, webhookRequest.id, webhookUrl, status),
        updateWhStatusWithError(error, webhookRequest.id, webhookUrl, settings.id),
      ]);
      sendAnalytics(status);
    }
  }
  return false;
}

/**
 * Updates the individual Webhook (WH) request status.
 */
async function updateWhRequestWithError(
  error: unknown,
  webhookRequestId: string,
  webhookUrl: string,
  status: WebhookRequestStatus
) {
  try {
    const detail =
      error instanceof WebhookError ? errorToWhStatusDetails(error) : errorToString(error);
    const httpStatus = error instanceof WebhookError ? error.additionalInfo.httpStatus : 500;
    await updateWebhookRequest({
      id: webhookRequestId,
      status,
      statusDetail: detail,
      requestUrl: webhookUrl,
      httpStatus,
    });
  } catch (error) {
    log(`Failed to store failure state on WH log: ${errorToString(error)}`);
    capture.error(error, {
      extra: {
        webhookRequestId: webhookRequestId,
        webhookUrl,
        context: `webhook.processRequest.updateStatus.failed`,
        error,
      },
    });
  }
}

/**
 * Updates the Customer's Webhook status on settings.
 */
async function updateWhStatusWithError(
  error: unknown,
  webhookRequestId: string,
  webhookUrl: string,
  settingsId: string
) {
  let webhookStatusDetail;
  if (error instanceof WebhookError) {
    webhookStatusDetail = errorToWhStatusDetails(error);
  } else {
    log(`Unexpected error testing webhook: ${errorToString(error)}`);
    webhookStatusDetail = `Internal error`;
  }
  try {
    // update the status of the webhook endpoint on the cx's settings table
    await updateWebhookStatus({
      cxId: settingsId,
      webhookEnabled: false,
      webhookStatusDetail,
    });
  } catch (error) {
    log(`Failed to store failure state on WH settings: ${errorToString(error)}`);
    capture.error(error, {
      extra: {
        webhookRequestId: webhookRequestId,
        webhookUrl,
        context: `webhook.processRequest.updateStatus.details`,
        error,
      },
    });
  }
}

const webhookResponseSchema = z
  .object({
    pong: z.string().optional(),
  })
  .or(z.string());

type WebhookResponse = z.infer<typeof webhookResponseSchema>;

export const sendPayload = async (
  payload: unknown,
  url: string,
  apiKey: string,
  timeout = DEFAULT_TIMEOUT_SEND_PAYLOAD_MS
): Promise<{
  status: number;
  webhookResponse: WebhookResponse;
  url: string;
  durationMillis: number;
}> => {
  try {
    const hmac = crypto.createHmac("sha256", apiKey).update(JSON.stringify(payload)).digest("hex");
    const before = Date.now();
    const res = await axios.post(url, payload, {
      headers: {
        "x-webhook-key": apiKey,
        "user-agent": "Metriport API",
        "x-metriport-signature": hmac,
      },
      timeout,
      maxRedirects: 0, // disable redirects to prevent SSRF
    });
    const duration = Date.now() - before;
    const webhookResponse = webhookResponseSchema.parse(res.data);
    return {
      status: res.status,
      webhookResponse,
      url,
      durationMillis: duration,
    };
  } catch (err) {
    // Don't change this error message, it's used to detect if the webhook is working or not
    const msg = "Failed to send payload";
    const httpStatus = getHttpStatusFromAxiosError(err);
    throw new WebhookError(msg, err, {
      url,
      httpStatus,
      httpMessage: errorToString(err),
    });
  }
};

export const sendTestPayload = async (url: string, key: string, cxId: string): Promise<boolean> => {
  const ping = nanoid();
  const when = dayjs().toISOString();
  const payload: WebhookPingPayload = {
    ping,
    meta: {
      messageId: uuidv4(),
      when,
      type: "ping",
    },
  };
  const [sendResponse, isWebhookPongDisabled] = await Promise.all([
    sendPayload(payload, url, key, DEFAULT_TIMEOUT_SEND_TEST_MS),
    isWebhookPongDisabledForCxSafe(cxId),
  ]);
  if (isWebhookPongDisabled) return true;
  // check for a matching pong response, unless FF is enabled to skip that check
  const whResponse = sendResponse.webhookResponse;
  return typeof whResponse !== "string" && whResponse.pong && whResponse.pong === ping
    ? true
    : false;
};

async function isWebhookPongDisabledForCxSafe(cxId: string): Promise<boolean> {
  try {
    return await isWebhookPongDisabledForCx(cxId);
  } catch (error) {
    const msg = "Error checking if WH Pong is disabled for cx";
    log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, { extra: { cxId, error } });
    // Fail gracefully since there was no error from Ping and we don't know if the cx supports Pong
  }
  return true;
}

export function isWebhookDisabled(meta?: unknown): boolean {
  if (!meta) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (meta as any)[webhookDisableFlagName];
  return isTrue(value);
}

export function errorToWhStatusDetails(error: WebhookError): string {
  if (error instanceof ZodError || error.cause instanceof ZodError) {
    return "Invalid response payload";
  }
  return errorToString(error);
}
