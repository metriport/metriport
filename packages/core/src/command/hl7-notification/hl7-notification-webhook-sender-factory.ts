import { Config } from "../../util/config";
import { Hl7NotificationWebhookSender } from "./hl7-notification-webhook-sender";
import { Hl7NotificationWebhookSenderCloud } from "./hl7-notification-webhook-sender-cloud";
import { Hl7NotificationWebhookSenderDirect } from "./hl7-notification-webhook-sender-direct";

export function buildHl7NotificationWebhookSender(): Hl7NotificationWebhookSender {
  if (Config.isDev()) {
    console.log(`Api load balancer address: ${Config.getApiLoadBalancerAddress()}`);
    return new Hl7NotificationWebhookSenderDirect(Config.getApiLoadBalancerAddress());
  }
  console.log(`Going to cloud: ${Config.getHl7NotificationQueueUrl()}`);
  return new Hl7NotificationWebhookSenderCloud(Config.getHl7NotificationQueueUrl());
}
