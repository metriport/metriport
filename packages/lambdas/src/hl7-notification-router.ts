import { Hl7Notification } from "@metriport/core/command/hl7-notification/hl7-notification-router";
import { capture } from "./shared/capture";

// Keep this as early on the file as possible
capture.init();

export async function handler(params: Hl7Notification): Promise<void> {
  capture.setExtra({
    cxId: params.cxId,
    patientId: params.patientId,
    payload: params.message,
    context: "hl7-notification-router-cloud.execute",
  });

  console.log("TODO: Send message to queue - see next PR");
}
