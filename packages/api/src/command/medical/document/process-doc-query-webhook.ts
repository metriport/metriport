import { errorToString } from "@metriport/core/util/error/shared";
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { processPatientDocumentRequest } from "./document-webhook";
import { MAPIWebhookStatus } from "./document-webhook";
import { getAllDocRefMapping } from "../docref-mapping/get-docref-mapping";
import { getDocuments } from "../../../external/fhir/document/get-documents";
import { toDTO, DocumentReferenceDTO } from "../../../routes/medical/dtos/documentDTO";
import { getAllWebhookRequestByRequestId } from "../../webhook/webhook-request";
import { Config } from "../../../shared/config";

const { log } = out(`Doc Query Webhook`);
const isSandbox = Config.isSandbox();
const DOWNLOAD_WEBHOOK_TYPE = "medical.document-download";
const CONVERSION_WEBHOOK_TYPE = "medical.document-conversion";

/**
 * Processes the document query progress to determine if when to send the document download and conversion webhooks
 */
export const processDocQueryProgressWebhook = async ({
  patient,
  documentQueryProgress,
  requestId,
}: {
  patient: Pick<Patient, "id" | "cxId" | "externalId">;
  documentQueryProgress: DocumentQueryProgress;
  requestId: string;
}): Promise<void> => {
  const { id: patientId } = patient;

  try {
    const webhooks = await getAllWebhookRequestByRequestId(requestId);
    const webhookSet = new Set(webhooks.map(webhook => webhook.type));
    const downloadWebhookSent = webhookSet.has(DOWNLOAD_WEBHOOK_TYPE);
    const convertWebhookSent = webhookSet.has(CONVERSION_WEBHOOK_TYPE);

    await handleDownloadWebhook(downloadWebhookSent, patient, requestId, documentQueryProgress);
    await handleConversionWebhook(convertWebhookSent, patient, requestId, documentQueryProgress);
  } catch (error) {
    const msg = `Error on processDocQueryProgressWebhook`;
    const extra = {
      documentQueryProgress,
      requestId,
      patientId,
      msg,
      context: `webhook.processDocQueryProgressWebhook`,
      error,
    };

    log(`${msg}: ${errorToString(error)} - ${JSON.stringify(extra)}`);
    capture.error(error, { extra });
  }
};

const handleDownloadWebhook = async (
  webhookSent: boolean,
  patient: Pick<Patient, "id" | "cxId" | "externalId">,
  requestId: string,
  documentQueryProgress: DocumentQueryProgress
): Promise<void> => {
  const downloadStatus = documentQueryProgress.download?.status;
  const isDownloadFinished = downloadStatus === "completed" || downloadStatus === "failed";

  const canProcessRequest = isDownloadFinished && !webhookSent;

  if (canProcessRequest && !isSandbox) {
    const downloadIsCompleted = downloadStatus === "completed";
    const payload = await composeDocRefPayload(patient.id, patient.cxId, requestId);

    processPatientDocumentRequest(
      patient.cxId,
      patient.id,
      DOWNLOAD_WEBHOOK_TYPE,
      downloadIsCompleted ? MAPIWebhookStatus.completed : MAPIWebhookStatus.failed,
      requestId,
      downloadIsCompleted ? payload : undefined
    );
  }
};

const handleConversionWebhook = async (
  webhookSent: boolean,
  patient: Pick<Patient, "id" | "cxId" | "externalId">,
  requestId: string,
  documentQueryProgress: DocumentQueryProgress
): Promise<void> => {
  const convertStatus = documentQueryProgress.convert?.status;
  const isConvertFinished = convertStatus === "completed" || convertStatus === "failed";

  const canProcessRequest = isConvertFinished && !webhookSent;

  if (canProcessRequest) {
    const convertIsCompleted = convertStatus === "completed";

    processPatientDocumentRequest(
      patient.cxId,
      patient.id,
      CONVERSION_WEBHOOK_TYPE,
      convertIsCompleted ? MAPIWebhookStatus.completed : MAPIWebhookStatus.failed,
      requestId
    );
  }
};

export const composeDocRefPayload = async (
  patientId: string,
  cxId: string,
  requestId: string
): Promise<DocumentReferenceDTO[]> => {
  const docRefs = await getAllDocRefMapping({ requestId });
  const docRefsIds = docRefs.map(docRef => docRef.id);
  const documents = await getDocuments({ patientId, cxId, documentIds: docRefsIds });

  return toDTO(documents);
};
