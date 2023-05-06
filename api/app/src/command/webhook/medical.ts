import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { getSettingsOrFail } from "../settings/getSettings";
import { ApiTypes, reportUsage as reportUsageCmd } from "../usage/report-usage";
import { createWebhookRequest } from "../webhook/webhook-request";
import { DocumentReferenceDTO } from "../../routes/medical/dtos/documentDTO";
import { processRequest, WebhookMetadataPayload } from "./webhook";

const log = Util.log(`Medical Webhook`);

// MAPI
type WebhookDocumentDataPayload = {
  documents: DocumentReferenceDTO[];
};
type WebhookPatientPayload = { patientId: string } & WebhookDocumentDataPayload;
type WebhookPatientDataPayload = {
  meta: WebhookMetadataPayload;
  patients: WebhookPatientPayload[];
};
type WebhookPatientDataPayloadWithoutMessageId = Omit<WebhookPatientDataPayload, "meta">;

export const processPatientDocumentRequest = async (
  cxId: string,
  patientId: string,
  documents: DocumentReferenceDTO[]
): Promise<boolean> => {
  const apiType = ApiTypes.medical;
  try {
    const settings = await getSettingsOrFail({ id: cxId });
    // create a representation of this request and store on the DB
    const payload: WebhookPatientDataPayloadWithoutMessageId = {
      patients: [{ patientId, documents }],
    };
    const webhookRequest = await createWebhookRequest({ cxId, payload });
    // send it to the customer and update the request status
    await processRequest(webhookRequest, settings, apiType);

    reportUsageCmd({ cxId, entityId: patientId, apiType });
  } catch (err) {
    log(`Error on processPatientDocumentRequest: `, err);
    capture.error(err, {
      extra: { patientId, context: `webhook.processPatientDocumentRequest` },
    });
  }
  return true;
};
