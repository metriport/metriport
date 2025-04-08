import { capture } from "./shared/capture";
import { Hl7NotificationRouterLocal } from "@metriport/core/command/hl7-notification/hl7-notification-router-local";
import { Hl7Notification } from "@metriport/core/command/hl7-notification/hl7-notification-router";

// Keep this as early on the file as possible
capture.init();

export async function handler(params: Hl7Notification): Promise<void> {
  capture.setExtra({
    cxId: params.cxId,
    patientId: params.patientId,
    payload: params.message,
    context: "hl7-notification-router-cloud.execute",
  });

  new Hl7NotificationRouterLocal().execute(params);
}
