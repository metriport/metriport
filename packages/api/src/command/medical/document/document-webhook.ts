import { PatientData } from "@metriport/core/domain/patient";
import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";
import { out } from "@metriport/core/util";
import { capture } from "@metriport/core/util/notifications";
import { MetriportError } from "@metriport/shared";
import { WebhookMetadata } from "@metriport/shared/medical";
import { PatientSourceIdentifierMap } from "../../../domain/patient-mapping";
import { Product } from "../../../domain/product";
import { MAPIWebhookType } from "../../../domain/webhook";
import { patientEvents } from "../../../event/medical/patient-event";
import { DocumentBulkUrlDTO } from "../../../routes/medical/dtos/document-bulk-downloadDTO";
import { DocumentReferenceDTO, toDTO } from "../../../routes/medical/dtos/documentDTO";
import { getSettingsOrFail } from "../../settings/getSettings";
import { reportUsage as reportUsageCmd } from "../../usage/report-usage";
import { isWebhookDisabled, processRequest } from "../../webhook/webhook";
import { createWebhookRequest } from "../../webhook/webhook-request";
import { getAllDocRefMapping } from "../docref-mapping/get-docref-mapping";
import { getDocumentQueryOrFail, setWebhookSent } from "../document-query";
import { getPatientOrFail } from "../patient/get-patient";

export enum MAPIWebhookStatus {
  completed = "completed",
  failed = "failed",
}

export const DOWNLOAD_WEBHOOK_TYPE = "medical.document-download";
export const CONVERSION_WEBHOOK_TYPE = "medical.document-conversion";

type WebhookDocumentDataPayload = {
  documents?: DocumentReferenceDTO[] | DocumentBulkUrlDTO[];
  status: MAPIWebhookStatus;
};
type WebhookPatientPayload = {
  patientId: string;
  externalId?: string;
  additionalIds?: PatientSourceIdentifierMap;
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
export async function processPatientDocumentRequest({
  cxId,
  patientId,
  requestId,
  whType,
  status,
  documents,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  whType: MAPIWebhookType;
  status: MAPIWebhookStatus;
  documents?: DocumentReferenceDTO[] | DocumentBulkUrlDTO[];
}): Promise<void> {
  const { log } = out(`Document Webhook - cxId: ${cxId}, patientId: ${patientId}`);
  try {
    const [settings, patient] = await Promise.all([
      getSettingsOrFail({ id: cxId }),
      getPatientOrFail({ id: patientId, cxId }),
    ]);

    let metadata: WebhookMetadata | undefined;
    if (whType === DOWNLOAD_WEBHOOK_TYPE || whType === CONVERSION_WEBHOOK_TYPE) {
      const docQuery = await getDocumentQueryOrFail({ cxId, patientId, requestId });
      if (docQuery.metaData) metadata = docQuery.metaData as WebhookMetadata;
    } else {
      const whMetadata = getMetadata(whType, patient.data);
      if (whMetadata) metadata = whMetadata as WebhookMetadata;
    }
    // create a representation of this request and store on the DB
    const payload: WebhookPatientDataPayloadWithoutMessageId = {
      patients: [
        {
          patientId,
          ...(patient.externalId ? { externalId: patient.externalId } : {}),
          ...(patient.additionalIds ? { additionalIds: patient.additionalIds } : {}),
          documents,
          status,
        },
      ],
    };

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
      log(`WH disabled. Not sending it - metadata: ${JSON.stringify(metadata)}`);
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

      await setWebhookSent({
        patientId,
        cxId,
        requestId,
        value: true,
        progressType,
      });
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
}

export async function composeDocRefPayload({
  cxId,
  patientId,
  requestId,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
}): Promise<DocumentReferenceDTO[]> {
  const docRefs = await getAllDocRefMapping({ requestId });
  const docRefsIds = docRefs.map(docRef => docRef.id);

  // We only want to call getDocuments if docRefsIds is a non-empty array.
  // Otherwise, it would return all DocumentReferences, and not just the ones we're interested in
  const documents =
    docRefsIds.length > 0 ? await getDocuments({ patientId, cxId, documentIds: docRefsIds }) : [];

  return toDTO(documents);
}

function getMetadata(whType: MAPIWebhookType, patientData: PatientData) {
  if (whType === "medical.document-download" || whType === "medical.document-conversion") {
    throw new MetriportError("Document metadata not implemented on patient");
  } else if (whType === "medical.consolidated-data") {
    return patientData.cxConsolidatedRequestMetadata;
  } else if (whType === "medical.document-bulk-download-urls") {
    return patientData.cxDownloadRequestMetadata;
  } else {
    return undefined;
  }
}
