import { Product } from "../../../domain/product";
import { MAPIWebhookType } from "../../../domain/webhook";
import { DocumentReferenceDTO } from "../../../routes/medical/dtos/documentDTO";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { getSettingsOrFail } from "../../settings/getSettings";
import { reportUsage as reportUsageCmd } from "../../usage/report-usage";
import { processRequest, WebhookMetadataPayload } from "../../webhook/webhook";
import { createWebhookRequest } from "../../webhook/webhook-request";

const log = Util.log(`Document Webhook`);

export enum MAPIWebhookStatus {
  completed = "completed",
  failed = "failed",
}

type WebhookDocumentDataPayload = {
  documents?: DocumentReferenceDTO[];
  status: MAPIWebhookStatus;
};
type WebhookPatientPayload = { patientId: string } & WebhookDocumentDataPayload;
type WebhookPatientDataPayload = {
  meta: WebhookMetadataPayload;
  patients: WebhookPatientPayload[];
};
type WebhookPatientDataPayloadWithoutMessageId = Omit<WebhookPatientDataPayload, "meta">;

/**
 * Sends a list of document references resulting of a doc query to the customer's
 * webhook URL. The list of document references is optional so we can send a failure
 * notification.
 *
 * Callers are not notified of issues/errors while processing the request -
 * nothing is thrown. Instead, the error is logged and captured (Sentry).
 */
export const processPatientDocumentRequest = async (
  cxId: string,
  patientId: string,
  whType: MAPIWebhookType,
  status: MAPIWebhookStatus,
  documents?: DocumentReferenceDTO[]
): Promise<void> => {
  try {
    const settings = await getSettingsOrFail({ id: cxId });
    // create a representation of this request and store on the DB
    const payload: WebhookPatientDataPayloadWithoutMessageId = {
      patients: [{ patientId, documents, status }],
    };
    const webhookRequest = await createWebhookRequest({ cxId, type: whType, payload });
    // send it to the customer and update the request status
    await processRequest(webhookRequest, settings);

    reportUsageCmd({ cxId, entityId: patientId, product: Product.medical });
  } catch (err) {
    log(`Error on processPatientDocumentRequest: ${err}`);
    capture.error(err, {
      extra: { patientId, context: `webhook.processPatientDocumentRequest`, err },
    });
  }
};
