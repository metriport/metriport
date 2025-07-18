import { DocumentQueryProgress, ProgressType } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { emptyFunction, errorToString } from "@metriport/shared";
import { DocumentReferenceDTO, toDTO } from "../../../routes/medical/dtos/documentDTO";
import { Config } from "../../../shared/config";
import { getAllDocRefMapping } from "../docref-mapping/get-docref-mapping";
import { finishSinglePatientImport } from "../patient/patient-import/finish-single-patient";
import { finishDischargeRequery } from "../patient/patient-monitoring/discharge-requery/finish";
import { MAPIWebhookStatus, processPatientDocumentRequest } from "./document-webhook";

const { log } = out(`Doc Query Webhook`);
const isSandbox = Config.isSandbox();
export const DOWNLOAD_WEBHOOK_TYPE = "medical.document-download";
export const CONVERSION_WEBHOOK_TYPE = "medical.document-conversion";

/**
 * Processes the document query progress to determine if when to send the document download and conversion webhooks
 */
export async function processDocQueryProgressWebhook({
  patient,
  documentQueryProgress,
  requestId,
  progressType,
}: {
  patient: Pick<Patient, "id" | "cxId" | "externalId">;
  documentQueryProgress: DocumentQueryProgress;
  requestId: string;
  progressType?: ProgressType;
}): Promise<void> {
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
}

async function handleDownloadWebhook(
  patient: Pick<Patient, "id" | "cxId" | "externalId">,
  requestId: string,
  documentQueryProgress: DocumentQueryProgress,
  progressType?: ProgressType
): Promise<void> {
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
}

async function handleConversionWebhook(
  patient: Pick<Patient, "id" | "cxId" | "externalId">,
  requestId: string,
  documentQueryProgress: DocumentQueryProgress,
  progressType?: ProgressType
): Promise<void> {
  const webhookSent = documentQueryProgress?.convert?.webhookSent ?? false;

  const convertStatus = documentQueryProgress.convert?.status;
  const isConvertFinished = convertStatus === "completed" || convertStatus === "failed";
  const isTypeConversion = progressType ? progressType === "convert" : true;

  const canProcessRequest = isConvertFinished && isTypeConversion && !webhookSent;

  if (canProcessRequest) {
    const convertIsCompleted = convertStatus === "completed";

    const whStatus = convertIsCompleted ? MAPIWebhookStatus.completed : MAPIWebhookStatus.failed;

    // Intentionally async
    processPatientDocumentRequest(
      patient.cxId,
      patient.id,
      CONVERSION_WEBHOOK_TYPE,
      whStatus,
      requestId
    ).catch(emptyFunction);

    // TODO 2330 The way we call this might need to be reviewed when we finish updating the data
    // pipeline to finish at the end of CONSOLIDATED (not conversion)
    // Intentionally async
    finishSinglePatientImport({
      cxId: patient.cxId,
      patientId: patient.id,
      requestId,
      status: convertIsCompleted ? "successful" : "failed",
    }).catch(emptyFunction);

    finishDischargeRequery({
      cxId: patient.cxId,
      patientId: patient.id,
      requestId,
      status: convertIsCompleted ? "successful" : "failed",
    }).catch(emptyFunction);
  }
}

// TODO: For some reason turning this into an arrow function makes tests fail
// eslint-disable-next-line @metriport/eslint-rules/no-named-arrow-functions
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
