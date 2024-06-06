import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import {
  MAPIWebhookType as MAPIWebhookTypeFromShared,
  WebhookType as WebhookTypeFromShared,
} from "@metriport/shared/medical";
import { Product } from "./product";

// TODO: 1411 - remove this section when DAPI is fully discontinued
export const dapiWHPrefix = Product.devices;
export const dapiWebhookType = [
  `${dapiWHPrefix}.provider-connected`,
  `${dapiWHPrefix}.provider-disconnected`,
  `${dapiWHPrefix}.health-data`,
] as const;
export type DAPIWebhookType = (typeof dapiWebhookType)[number];

export type MAPIWebhookType = MAPIWebhookTypeFromShared;
export type WebhookType = WebhookTypeFromShared | DAPIWebhookType;

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
