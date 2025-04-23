import { capture, out } from "@metriport/core/util";
import { MetriportError, errorToString } from "@metriport/shared";
import { ConsolidatedWebhookRequest as Hl7NotificationWebhookRequest } from "@metriport/shared/medical";
import { getSettingsOrFail } from "../../settings/getSettings";
import { createWebhookRequest } from "../../webhook/webhook-request";
import { processRequest } from "../../webhook/webhook";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { PatientSourceIdentifierMap } from "../../../domain/patient-mapping";
import { getPatientOrFail } from "./get-patient";
import { buildDocRefBundleWithAttachment } from "./convert-fhir-bundle";

type PayloadWithoutMeta = Omit<Hl7NotificationWebhookRequest, "meta"> & {
  additionalIds?: PatientSourceIdentifierMap;
};

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
  const { log } = out(`processHl7FhirBundleWebhook, cx: ${cxId}, pt: ${patientId}`);
  const requestId = uuidv7();
  log(`req - ${requestId}, event - ${triggerEvent}`);

  try {
    const [settings, currentPatient] = await Promise.all([
      getSettingsOrFail({ id: cxId }),
      getPatientOrFail({ id: patientId, cxId }),
    ]);
    const webhookType = mapTriggerEventToWebhookType(triggerEvent);

    const bundle = buildDocRefBundleWithAttachment(patientId, presignedUrl, "json");

    const payload: PayloadWithoutMeta = {
      patients: [
        {
          patientId,
          ...(currentPatient.externalId ? { externalId: currentPatient.externalId } : {}),
          ...(currentPatient.additionalIds ? { additionalIds: currentPatient.additionalIds } : {}),
          status: "completed",
          bundle,
        },
      ],
    };

    const webhookRequest = await createWebhookRequest({
      cxId,
      type: `medical.hl7.${webhookType}`,
      payload,
      requestId,
    });

    const additionalWHRequestMeta: Record<string, string> = { requestId };

    await processRequest(webhookRequest, settings, additionalWHRequestMeta);
  } catch (err) {
    const msg = `Failed to send hl7 notification webhook`;
    log(`${msg}, error - ${errorToString(err)}`);
    capture.error(msg, {
      extra: { patientId, context: `webhook.processHl7FhirBundleWebhook`, err },
    });
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
