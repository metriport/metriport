import { isHl7NotificationWebhookFeatureFlagEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { capture, out } from "@metriport/core/util";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MetriportError, errorToString } from "@metriport/shared";
import { getSettingsOrFail } from "../../settings/getSettings";
import { processRequest } from "../../webhook/webhook";
import { createWebhookRequest } from "../../webhook/webhook-request";
import { getPatientOrFail } from "./get-patient";
import { Hl7NotificationWebhookRequest } from "../../../routes/medical/schemas/hl7-notification";
import { Hl7WebhookTypeSchemaType } from "@metriport/shared/medical";

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

    if (await isHl7NotificationWebhookFeatureFlagEnabledForCx(cxId)) {
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
