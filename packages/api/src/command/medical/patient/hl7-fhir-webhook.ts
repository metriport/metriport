import { isHl7NotificationWebhookFeatureFlagEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { capture, out } from "@metriport/core/util";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MetriportError, errorToString } from "@metriport/shared";
import { getSettingsOrFail } from "../../settings/getSettings";
import { processRequest } from "../../webhook/webhook";
import { createWebhookRequest } from "../../webhook/webhook-request";
import { getPatientOrFail } from "./get-patient";

export async function processHl7FhirBundleWebhook({
  cxId,
  patientId,
  presignedUrl,
  triggerEvent,
}: {
  cxId: string;
  patientId: string;
  presignedUrl: string;
  triggerEvent: string;
}): Promise<void> {
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

    const payload = {
      patientId,
      ...(currentPatient.externalId ? { externalId: currentPatient.externalId } : {}),
      ...(currentPatient.additionalIds ? { additionalIds: currentPatient.additionalIds } : {}),
      url: presignedUrl,
    };

    if (!(await isHl7NotificationWebhookFeatureFlagEnabledForCx(cxId))) {
      log(`WH FF disabled. Not sending it...`);
      await createWebhookRequest({
        cxId,
        type: `medical.hl7.${webhookType}`,
        payload,
        requestId,
        status: "success",
      });
      return;
    }

    const webhookRequest = await createWebhookRequest({
      cxId,
      type: `medical.hl7.${webhookType}`,
      payload,
      requestId,
    });

    await processRequest(webhookRequest, settings, { requestId });
  } catch (err) {
    const msg = `Failed to send hl7 notification webhook`;
    log(`${msg}, error - ${errorToString(err)}`);
    throw err;
  }
}

function mapTriggerEventToWebhookType(triggerEvent: string) {
  switch (triggerEvent) {
    case "A01": {
      return "admit";
    }
    case "A03": {
      return "discharge";
    }
    default: {
      throw new MetriportError("Unsupported HL7 triggerEvent for the webhook", undefined, {
        triggerEvent,
      });
    }
  }
}
