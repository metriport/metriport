import { makeWebhook } from "../../domain/__tests__/webhook";
import { WebhookRequest } from "../webhook-request";
import { WebhookType } from "../../domain/webhook";
import { WebhookRequestStatus } from "../webhook-request";

export const makeWebhookModel = (params: {
  id: string;
  webhookType: WebhookType;
  status?: WebhookRequestStatus;
}): WebhookRequest => makeWebhook(params) as WebhookRequest;
