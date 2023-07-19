import { WebhookRequest } from "../../models/webhook-request";
import { ApiTypes, reportUsage as reportUsageCmd } from "../usage/report-usage";

export const dapiWebhookType = [
  "devices.provider-connected",
  "devices.provider-disconnected",
  "devices.health-data",
] as const;
export type DAPIWebhookType = (typeof dapiWebhookType)[number];

export function isDAPIWebhookRequest(webhookRequest: WebhookRequest): boolean {
  return dapiWebhookType.map(String).includes(webhookRequest.type);
}

export const reportDevicesUsage = (cxId: string, cxUserIds: string[]): void => {
  const apiType = ApiTypes.devices;
  cxUserIds.forEach(cxUserId => reportUsageCmd({ cxId, entityId: cxUserId, apiType }));
};
