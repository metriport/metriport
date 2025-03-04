import { DocumentQueryProgress, ProgressType } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { DocumentReferenceDTO, toDTO } from "../../../routes/medical/dtos/documentDTO";
import { Config } from "../../../shared/config";
import { getAllDocRefMapping } from "../docref-mapping/get-docref-mapping";
import { MAPIWebhookStatus, processPatientDocumentRequest } from "./document-webhook";

const { log } = out(`Doc Query Webhook`);
const isSandbox = Config.isSandbox();
export const DOWNLOAD_WEBHOOK_TYPE = "medical.document-download";
export const CONVERSION_WEBHOOK_TYPE = "medical.document-conversion";

export type ProcessDocQueryProgressWebhookParams = {
  patient: Pick<Patient, "id" | "cxId" | "externalId" | "data">;
  requestId: string;
  isDoneConsolidated?: boolean;
  progressType?: ProgressType;
};

/**
 * Processes the document query progress to determine if when to send the document download and conversion webhooks
 */
export const processDocQueryProgressWebhook = async ({
  patient,
  requestId,
  progressType,
}: {
  patient: Pick<Patient, "id" | "cxId" | "externalId" | "data">;
  requestId: string;
  progressType?: ProgressType;
}): Promise<void> => {
  const { id: patientId } = patient;
  const { documentQueryProgress } = patient.data;

  try {
    if (documentQueryProgress) {
      await handleDownloadWebhook(patient, requestId, documentQueryProgress, progressType);
      await handleConversionWebhook(patient, requestId, documentQueryProgress, progressType);
    }
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
  const webhookSent = documentQueryProgress.download?.webhookSent ?? false;

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
  console.log("handleConversionWebhook", patient, requestId, documentQueryProgress, progressType);
  const webhookSent = documentQueryProgress?.convert?.webhookSent ?? false;

  const convertStatus = documentQueryProgress.convert?.status;
  const isConvertFinished = convertStatus === "completed" || convertStatus === "failed";
  const isTypeConversion = progressType ? progressType === "convert" : false;

  const canProcessRequest = isConvertFinished && isTypeConversion && !webhookSent;

  console.log(
    "isConvertFinished, isTypeConversion, !webhookSent",
    isConvertFinished,
    isTypeConversion,
    !webhookSent
  );
  console.log("therefore canProcessRequest", canProcessRequest);
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

  // We only want to call getDocuments if docRefsIds is a non-empty array.
  // Otherwise, it would return all DocumentReferences, and not just the ones we're interested in
  const documents =
    docRefsIds.length > 0 ? await getDocuments({ patientId, cxId, documentIds: docRefsIds }) : [];

  return toDTO(documents);
};
