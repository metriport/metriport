import { PatientData } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util";
import { WebhookMetadata } from "@metriport/shared/medical";
import { Product } from "../../../domain/product";
import { MAPIWebhookType } from "../../../domain/webhook";
import { patientEvents } from "../../../event/medical/patient-event";
import { DocumentBulkUrlDTO } from "../../../routes/medical/dtos/document-bulk-downloadDTO";
import { DocumentReferenceDTO } from "../../../routes/medical/dtos/documentDTO";
import { capture } from "../../../shared/notifications";
import { getSettingsOrFail } from "../../settings/getSettings";
import { reportUsage as reportUsageCmd } from "../../usage/report-usage";
import { isWebhookDisabled, processRequest } from "../../webhook/webhook";
import { createWebhookRequest } from "../../webhook/webhook-request";
import { updateProgressWebhookSent } from "../patient/append-doc-query-progress";
import { getPatientOrFail } from "../patient/get-patient";
import { CONVERSION_WEBHOOK_TYPE, DOWNLOAD_WEBHOOK_TYPE } from "./process-doc-query-webhook";

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
  meta: WebhookMetadata;
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
  requestId: string | undefined,
  documents?: DocumentReferenceDTO[] | DocumentBulkUrlDTO[]
): Promise<void> => {
  const { log } = out(`Document Webhook - cxId: ${cxId}, patientId: ${patientId}`);
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
    const metadata = getMetadata(whType, patient.data);

    // send it to the customer and update the request status
    if (!isWebhookDisabled(metadata)) {
      log(`Sending WH... metadata: ${metadata}`);
      const webhookRequest = await createWebhookRequest({
        cxId,
        type: whType,
        payload,
        requestId,
      });

      await processRequest(
        webhookRequest,
        settings,
        requestId ? { requestId } : undefined,
        metadata
      );
    } else {
      log(`WH disabled. Not sending it - metadata: ${metadata}`);
      await createWebhookRequest({
        cxId,
        type: whType,
        payload,
        requestId,
        status: "success",
      });
    }

    if (whType === DOWNLOAD_WEBHOOK_TYPE || whType === CONVERSION_WEBHOOK_TYPE) {
      const progressType = whType === DOWNLOAD_WEBHOOK_TYPE ? "download" : "convert";

      await updateProgressWebhookSent(
        {
          id: patientId,
          cxId,
        },
        progressType
      );
    }

    patientEvents().emitCanvasIntegration({ id: patientId, cxId, metadata, whType });

    const shouldReportUsage =
      status === MAPIWebhookStatus.completed &&
      documents &&
      documents?.length > 0 &&
      whType === "medical.document-download";

    if (shouldReportUsage) {
      reportUsageCmd({ cxId, entityId: patientId, product: Product.medical, docQuery: true });
    }
  } catch (err) {
    log(`Error on processPatientDocumentRequest: ${err}`);
    capture.error(err, {
      extra: { patientId, context: `webhook.processPatientDocumentRequest`, err },
    });
  }
};

function getMetadata(whType: MAPIWebhookType, patientData: PatientData) {
  if (whType === "medical.document-download" || whType === "medical.document-conversion") {
    return patientData.cxDocumentRequestMetadata;
  } else if (whType === "medical.consolidated-data") {
    return patientData.cxConsolidatedRequestMetadata;
  } else if (whType === "medical.document-bulk-download-urls") {
    return patientData.cxDownloadRequestMetadata;
  } else {
    return undefined;
  }
}
