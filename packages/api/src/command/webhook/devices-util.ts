import { dapiWHPrefix } from "../../domain/webhook";
import { WebhookRequest } from "../../models/webhook-request";

export function isDAPIWebhookRequest(webhookRequest: WebhookRequest): boolean {
  return webhookRequest.type.startsWith(dapiWHPrefix);
}
