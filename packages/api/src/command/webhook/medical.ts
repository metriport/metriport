import { DocumentReferenceDTO } from "../../routes/medical/dtos/documentDTO";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { getSettingsOrFail } from "../settings/getSettings";
import { ApiTypes, reportUsage as reportUsageCmd } from "../usage/report-usage";
import { WebhookMetadataPayload, processRequest } from "./webhook";
import { createWebhookRequest } from "./webhook-request";

const log = Util.log(`Medical Webhook`);

export enum MAPIWebhookType {
  documentDownload = "document-download",
  documentConversion = "document-conversion",
}

export enum MAPIWebhookStatus {
  completed = "completed",
  failed = "failed",
}

type WebhookDocumentDataPayload = {
  documents?: DocumentReferenceDTO[];
  type: MAPIWebhookType;
  status: MAPIWebhookStatus;
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
  type: MAPIWebhookType,
  status: MAPIWebhookStatus,
  documents?: DocumentReferenceDTO[]
): Promise<boolean> => {
  const apiType = ApiTypes.medical;
  try {
    const settings = await getSettingsOrFail({ id: cxId });
    // create a representation of this request and store on the DB
    const payload: WebhookPatientDataPayloadWithoutMessageId = {
      patients: [{ patientId, documents, type, status }],
    };
    const webhookRequest = await createWebhookRequest({ cxId, type, payload });
    // send it to the customer and update the request status
    await processRequest(webhookRequest, settings);

    reportUsageCmd({ cxId, entityId: patientId, apiType });
  } catch (err) {
    log(`Error on processPatientDocumentRequest: ${err}`);
    capture.error(err, {
      extra: { patientId, context: `webhook.processPatientDocumentRequest`, err },
    });
  }
  return true;
};
