import { dapiWHPrefix } from "../../domain/webhook";
import { WebhookRequest } from "../../models/webhook-request";
import { WebhookRequestData } from "./webhook-request";

export function isDAPIWebhookRequest(webhookRequest: WebhookRequest | WebhookRequestData): boolean {
  return webhookRequest.type.startsWith(dapiWHPrefix);
}
