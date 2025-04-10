import { Config } from "../../util/config";
import { Hl7NotificationRouter } from "./hl7-notification-router";
import { Hl7NotificationRouterCloud } from "./hl7-notification-router-cloud";
import { Hl7NotificationRouterDirect } from "./hl7-notification-router-local";

export function buildHl7NotificationRouter(): Hl7NotificationRouter {
  if (Config.isDev()) return new Hl7NotificationRouterDirect();
  const queueUrl = Config.getHl7NotificationQueueUrl();
  return new Hl7NotificationRouterCloud(queueUrl);
}
