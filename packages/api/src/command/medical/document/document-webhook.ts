import { DocumentReferenceDTO } from "../../../routes/medical/dtos/documentDTO";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { getSettingsOrFail } from "../../settings/getSettings";
import { ApiTypes, reportUsage as reportUsageCmd } from "../../usage/report-usage";
import { WebhookMetadataPayload, processRequest } from "../../webhook/webhook";
import { createWebhookRequest } from "../../webhook/webhook-request";

const log = Util.log(`Medical Webhook`);

export const mapiWebhookType = [
  "medical.document-download",
  "medical.document-conversion",
] as const;
export type MAPIWebhookType = (typeof mapiWebhookType)[number];

// TODO remove this with #898
export const mapiMessageType = ["document-download", "document-conversion"] as const;
export type MAPIMessageType = (typeof mapiMessageType)[number];

export const webhookTypeToMessageType: Record<MAPIWebhookType, MAPIMessageType> = {
  ["medical.document-download"]: "document-download",
  ["medical.document-conversion"]: "document-conversion",
};

export enum MAPIWebhookStatus {
  completed = "completed",
  failed = "failed",
}

type WebhookDocumentDataPayload = {
  documents?: DocumentReferenceDTO[];
  /**
   * Use the main webhook type on 'metadata' instead.
   * @deprecated
   */
  type: MAPIMessageType; // TODO remove this with #898
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
  whType: MAPIWebhookType,
  status: MAPIWebhookStatus,
  documents?: DocumentReferenceDTO[]
): Promise<boolean> => {
  const apiType = ApiTypes.medical;
  try {
    const settings = await getSettingsOrFail({ id: cxId });
    // create a representation of this request and store on the DB
    const payload: WebhookPatientDataPayloadWithoutMessageId = {
      patients: [{ patientId, documents, type: webhookTypeToMessageType[whType], status }],
    };
    const webhookRequest = await createWebhookRequest({ cxId, type: whType, payload });
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
