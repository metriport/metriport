import {
  isDischargeSlackNotificationFeatureFlagEnabledForCx,
  isHl7NotificationWebhookFeatureFlagEnabledForCx,
} from "@metriport/core/command/feature-flags/domain-ffs";
import { sendToSlack, SlackMessage } from "@metriport/core/external/slack";
import { capture, out } from "@metriport/core/util";
import { Config } from "@metriport/core/util/config";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { errorToString, MetriportError } from "@metriport/shared";
import { Hl7WebhookTypeSchemaType } from "@metriport/shared/medical";
import { Hl7NotificationWebhookRequest } from "../../../routes/medical/schemas/hl7-notification";
import { getSettingsOrFail } from "../../settings/getSettings";
import { processRequest } from "../../webhook/webhook";
import { createWebhookRequest } from "../../webhook/webhook-request";
import { getPatientOrFail } from "./get-patient";

const EVENT_TARGET_PATIENT = "patient";
const EVENT_ADMIT = "admit";
const EVENT_DISCHARGE = "discharge";

export async function processHl7FhirBundleWebhook({
  cxId,
  patientId,
  presignedUrl,
  triggerEvent,
  whenSourceSent,
  admitTimestamp,
  dischargeTimestamp,
}: Hl7NotificationWebhookRequest): Promise<void> {
  capture.setExtra({ patientId, context: `webhook.processHl7FhirBundleWebhook` });
  const { log } = out(`processHl7FhirBundleWebhook, cx: ${cxId}, pt: ${patientId}`);

  const requestId = uuidv7();
  log(`req - ${requestId}, event - ${triggerEvent}`);

  try {
    const [settings, currentPatient] = await Promise.all([
      getSettingsOrFail({ id: cxId }),
      getPatientOrFail({ id: patientId, cxId }),
    ]);
    const webhookType = mapTriggerEventToWebhookType(triggerEvent);

    const whData = {
      payload: {
        patientId,
        ...(currentPatient.externalId ? { externalId: currentPatient.externalId } : {}),
        ...(currentPatient.additionalIds ? { additionalIds: currentPatient.additionalIds } : {}),
        url: presignedUrl,
        whenSourceSent,
        admitTimestamp,
        dischargeTimestamp,
      },
    };

    // ENG-536 remove this once we automatically find the discharge summary
    if (
      triggerEvent === "A03" &&
      (await isDischargeSlackNotificationFeatureFlagEnabledForCx(cxId))
    ) {
      try {
        const messagePayload = {
          cxId,
          patientId,
          admitTimestamp,
          dischargeTimestamp,
        };

        const message: SlackMessage = {
          subject: `Patient Discharge Detected`,
          message: JSON.stringify(messagePayload, null, 2),
          emoji: ":hospital:",
        };

        const channelUrl = Config.getDischargeNotificationSlackUrl();
        await sendToSlack(message, channelUrl);
        log(`Slack discharge notification sent successfully`);
      } catch (slackError) {
        log(`Failed to send Slack discharge notification: ${errorToString(slackError)}`);
      }
    }

    if (!(await isHl7NotificationWebhookFeatureFlagEnabledForCx(cxId))) {
      log(`WH FF disabled. Not sending it...`);
      await createWebhookRequest({
        cxId,
        type: webhookType,
        payload: whData,
        requestId,
        status: "success",
      });
      return;
    }

    const webhookRequest = await createWebhookRequest({
      cxId,
      type: webhookType,
      payload: whData,
      requestId,
    });

    await processRequest(webhookRequest, settings, { requestId });
  } catch (err) {
    const msg = `Failed to send hl7 notification webhook`;
    log(`${msg}, error - ${errorToString(err)}`);
    throw err;
  }

  log(`Done. Webhook sent..`);
}

function mapTriggerEventToWebhookType(triggerEvent: string): Hl7WebhookTypeSchemaType {
  switch (triggerEvent) {
    case "A01": {
      return `${EVENT_TARGET_PATIENT}.${EVENT_ADMIT}`;
    }
    case "A03": {
      return `${EVENT_TARGET_PATIENT}.${EVENT_DISCHARGE}`;
    }
    default: {
      throw new MetriportError("Unsupported HL7 triggerEvent for the webhook", undefined, {
        triggerEvent,
      });
    }
  }
}
