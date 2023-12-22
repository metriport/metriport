import { Product } from "../../../domain/product";
import { MAPIWebhookType } from "../../../domain/webhook";
import { DocumentReferenceDTO } from "../../../routes/medical/dtos/documentDTO";
import { DocumentBulkUrlDTO } from "../../../routes/medical/dtos/document-bulk-downloadDTO";
import { capture } from "@metriport/core/util/capture";
import { Util } from "../../../shared/util";
import { getSettingsOrFail } from "../../settings/getSettings";
import { getPatientOrFail } from "../patient/get-patient";
import { reportUsage as reportUsageCmd } from "../../usage/report-usage";
import { processRequest, WebhookMetadataPayload, isWebhookDisabled } from "../../webhook/webhook";
import { createWebhookRequest } from "../../webhook/webhook-request";
const log = Util.log(`Document Webhook`);

export enum MAPIWebhookStatus {
  completed = "completed",
  failed = "failed",
}

type WebhookDocumentDataPayload = {
  documents?: DocumentReferenceDTO[] | DocumentBulkUrlDTO[];
  status: MAPIWebhookStatus;
};
type WebhookPatientPayload = {
  patientId: string;
  externalId?: string;
} & WebhookDocumentDataPayload;
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
  documents?: DocumentReferenceDTO[] | DocumentBulkUrlDTO[]
): Promise<void> => {
  try {
    const [settings, patient] = await Promise.all([
      getSettingsOrFail({ id: cxId }),
      getPatientOrFail({ id: patientId, cxId }),
    ]);

    // create a representation of this request and store on the DB
    const payload: WebhookPatientDataPayloadWithoutMessageId = {
      patients: [
        {
          patientId,
          ...(patient.externalId ? { externalId: patient.externalId } : {}),
          documents,
          status,
        },
      ],
    };
    // send it to the customer and update the request status
    if (!isWebhookDisabled(patient.data.cxDocumentRequestMetadata)) {
      const webhookRequest = await createWebhookRequest({
        cxId,
        type: whType,
        payload,
      });
      await processRequest(
        webhookRequest,
        settings,
        undefined,
        patient.data.cxDocumentRequestMetadata
      );
    } else {
      await createWebhookRequest({
        cxId,
        type: whType,
        payload,
        status: "success",
      });
    }

    reportUsageCmd({ cxId, entityId: patientId, product: Product.medical });
  } catch (err) {
    log(`Error on processPatientDocumentRequest: ${err}`);
    capture.error(err, {
      extra: { patientId, context: `webhook.processPatientDocumentRequest`, err },
    });
  }
};
