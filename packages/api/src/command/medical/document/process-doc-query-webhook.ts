import { errorToString } from "@metriport/core/util/error/shared";
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import { DocumentQueryProgress, ProgressType } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { processPatientDocumentRequest } from "./document-webhook";
import { MAPIWebhookStatus } from "./document-webhook";
import { getAllDocRefMapping } from "../docref-mapping/get-docref-mapping";
import { getDocumentsFromFHIR } from "../../../external/fhir/document/get-documents";
import { toDTO, DocumentReferenceDTO } from "../../../routes/medical/dtos/documentDTO";
import { Config } from "../../../shared/config";

const { log } = out(`Doc Query Webhook`);
const isSandbox = Config.isSandbox();
export const DOWNLOAD_WEBHOOK_TYPE = "medical.document-download";
export const CONVERSION_WEBHOOK_TYPE = "medical.document-conversion";

/**
 * Processes the document query progress to determine if when to send the document download and conversion webhooks
 */
export const processDocQueryProgressWebhook = async ({
  patient,
  documentQueryProgress,
  requestId,
  progressType,
}: {
  patient: Pick<Patient, "id" | "cxId" | "externalId">;
  documentQueryProgress: DocumentQueryProgress;
  requestId: string;
  progressType?: ProgressType;
}): Promise<void> => {
  const { id: patientId } = patient;

  try {
    await handleDownloadWebhook(patient, requestId, documentQueryProgress, progressType);
    await handleConversionWebhook(patient, requestId, documentQueryProgress, progressType);
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
  patient: Pick<Patient, "id" | "cxId" | "externalId">,
  requestId: string,
  documentQueryProgress: DocumentQueryProgress,
  progressType?: ProgressType
): Promise<void> => {
  const webhookSent = documentQueryProgress?.download?.webhookSent ?? false;

  const downloadStatus = documentQueryProgress.download?.status;
  const isDownloadFinished = downloadStatus === "completed" || downloadStatus === "failed";
  const isTypeDownload = progressType ? progressType === "download" : true;

  const canProcessRequest = isDownloadFinished && isTypeDownload && !webhookSent;

  if (canProcessRequest && !isSandbox) {
    const downloadIsCompleted = downloadStatus === "completed";
    const payload = await composeDocRefPayload(patient.id, patient.cxId, requestId);

    const whStatus = downloadIsCompleted ? MAPIWebhookStatus.completed : MAPIWebhookStatus.failed;

    processPatientDocumentRequest(
      patient.cxId,
      patient.id,
      DOWNLOAD_WEBHOOK_TYPE,
      whStatus,
      requestId,
      downloadIsCompleted ? payload : undefined
    );
  }
};

const handleConversionWebhook = async (
  patient: Pick<Patient, "id" | "cxId" | "externalId">,
  requestId: string,
  documentQueryProgress: DocumentQueryProgress,
  progressType?: ProgressType
): Promise<void> => {
  const webhookSent = documentQueryProgress?.convert?.webhookSent ?? false;

  const convertStatus = documentQueryProgress.convert?.status;
  const isConvertFinished = convertStatus === "completed" || convertStatus === "failed";
  const isTypeConversion = progressType ? progressType === "convert" : true;

  const canProcessRequest = isConvertFinished && isTypeConversion && !webhookSent;

  if (canProcessRequest) {
    const convertIsCompleted = convertStatus === "completed";

    const whStatus = convertIsCompleted ? MAPIWebhookStatus.completed : MAPIWebhookStatus.failed;

    processPatientDocumentRequest(
      patient.cxId,
      patient.id,
      CONVERSION_WEBHOOK_TYPE,
      whStatus,
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
  const documents = await getDocumentsFromFHIR({ patientId, cxId, documentIds: docRefsIds });

  return toDTO(documents);
};
