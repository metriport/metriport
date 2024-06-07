import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { Product } from "./product";

// TODO: 1411 - remove this section when DAPI is fully discontinued
export const dapiWHPrefix = Product.devices;
export const dapiWebhookType = [
  `${dapiWHPrefix}.provider-connected`,
  `${dapiWHPrefix}.provider-disconnected`,
  `${dapiWHPrefix}.health-data`,
] as const;
export type DAPIWebhookType = (typeof dapiWebhookType)[number];

export const mapiWHPrefix = Product.medical;
export const mapiWebhookType = [
  `${mapiWHPrefix}.document-download`,
  `${mapiWHPrefix}.document-conversion`,
  `${mapiWHPrefix}.consolidated-data`,
  `${mapiWHPrefix}.document-bulk-download-urls`,
] as const;
export type MAPIWebhookType = (typeof mapiWebhookType)[number];
export type PingWebhookType = "ping";
export type WebhookType = DAPIWebhookType | MAPIWebhookType | PingWebhookType;

export type WebhookRequestStatus = "processing" | "success" | "failure";

export interface WebhookRequestCreate extends Omit<BaseDomainCreate, "id"> {
  cxId: string;
  requestId?: string;
  type: WebhookType;
  payload: object;
  status?: WebhookRequestStatus;
  statusDetail?: string;
  requestUrl?: string;
  httpStatus?: number;
  durationMillis?: number;
}

export interface WebhookRequest extends BaseDomain, WebhookRequestCreate {}
