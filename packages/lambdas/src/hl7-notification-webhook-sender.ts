import { Hl7Notification } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender";
import { Hl7NotificationWebhookSenderDirect } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender-direct";
import { capture } from "./shared/capture";
import * as Sentry from "@sentry/serverless";

// Keep this as early on the file as possible
capture.init();

export const handler = Sentry.AWSLambda.wrapHandler(
  async (params: Hl7Notification): Promise<void> => {
    capture.setExtra({
      cxId: params.cxId,
      patientId: params.patientId,
      payload: params.message,
      context: "hl7-notification-webhook-sender-cloud.execute",
    });

    await new Hl7NotificationWebhookSenderDirect().execute(params);
  }
);
