import { errorToString } from "@metriport/core/util/error/index";
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import { DocumentQueryProgress } from "../../../domain/medical/document-query";
import { Patient } from "../../../domain/medical/patient";
import { Product } from "../../../domain/product";
import { processPatientDocumentRequest } from "./document-webhook";
import { MAPIWebhookStatus } from "./document-webhook";
import { reportUsage as reportUsageCmd } from "../../usage/report-usage";
import { getAllDocRefMappingByRequestId } from "../docref-mapping/get-docref-mapping";
import { getDocuments } from "../../../external/fhir/document/get-documents";
import { toDTO, DocumentReferenceDTO } from "../../../routes/medical/dtos/documentDTO";
import { getAllWebhookRequestByRequestId } from "../../webhook/webhook-request";
import { Config } from "../../../shared/config";

const { log } = out(`Doc Query Webhook`);
const isSandbox = Config.isSandbox();

// NEED TO UPDATE THIS BELOW
// ALSO NEED TO ACCOUNT FOR WHEN THE WEBHOOK VARIABLE IS NOT TO SEND FOR OPS
/**
 * Sends a list of document references resulting of a doc query to the customer's
 * webhook URL. The list of document references is optional so we can send a failure
 * notification.
 *
 * Callers are not notified of issues/errors while processing the request -
 * nothing is thrown. Instead, the error is logged and captured (Sentry).
 */
export const processDocQueryProgressWebhook = async ({
  patient,
  docQueryProgress,
  requestId,
}: {
  patient: Pick<Patient, "id" | "cxId" | "externalId">;
  docQueryProgress: DocumentQueryProgress;
  requestId: string;
}): Promise<void> => {
  const apiType = Product.medical;
  const { id: patientId, cxId } = patient;

  try {
    let successfulDownloadWebhookSent = false;

    const downloadStatus = docQueryProgress.download?.status;
    const convertStatus = docQueryProgress.convert?.status;

    const webhooks = await getAllWebhookRequestByRequestId(requestId);
    const downloadWebhookSent = webhooks.some(
      webhook => webhook.type === "medical.document-download"
    );
    const convertWebhookSent = webhooks.some(
      webhook => webhook.type === "medical.document-conversion"
    );

    if (!downloadWebhookSent && !isSandbox) {
      if (downloadStatus === "failed") {
        processPatientDocumentRequest(
          patient.cxId,
          patient.id,
          "medical.document-download",
          MAPIWebhookStatus.failed,
          requestId
        );
      } else if (downloadStatus === "completed") {
        const payload = await composeDocRefPayload(patient.id, patient.cxId, requestId);

        processPatientDocumentRequest(
          patient.cxId,
          patient.id,
          "medical.document-download",
          MAPIWebhookStatus.completed,
          requestId,
          payload
        );
        successfulDownloadWebhookSent = true;
      }
    }

    if (!convertWebhookSent) {
      if (convertStatus === "failed") {
        processPatientDocumentRequest(
          patient.cxId,
          patient.id,
          "medical.document-conversion",
          MAPIWebhookStatus.failed,
          requestId
        );
      } else if (convertStatus === "completed") {
        processPatientDocumentRequest(
          patient.cxId,
          patient.id,
          "medical.document-conversion",
          MAPIWebhookStatus.completed,
          requestId
        );
      }
    }

    if (successfulDownloadWebhookSent) {
      reportUsageCmd({ cxId, entityId: patientId, product: apiType, docQuery: true });
    }
  } catch (err) {
    log(`Error on processDocQueryProgressWebhook: ${errorToString(err)}`);
    capture.error(err, {
      extra: { patientId, context: `webhook.processDocQueryProgressWebhook`, err },
    });
  }
};

const composeDocRefPayload = async (
  patientId: string,
  cxId: string,
  requestId: string
): Promise<DocumentReferenceDTO[]> => {
  const docRefs = await getAllDocRefMappingByRequestId(requestId);
  const docRefsIds = docRefs.map(docRef => docRef.id);
  const documents = await getDocuments({ patientId, cxId, documentIds: docRefsIds });

  return toDTO(documents);
};
