import { Product } from "./product";
import { z } from "zod";

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
] as const;
export type MAPIWebhookType = (typeof mapiWebhookType)[number];

export type WebhookType = DAPIWebhookType | MAPIWebhookType;

export const cxWebhookPayloadSchemaOptional = z.record(z.string()).optional();
