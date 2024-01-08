import { errorToString } from "@metriport/core/util/error/index";
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import { DocumentQueryProgress } from "../../../domain/medical/document-query";
import { WebhookRequest } from "../../../models/webhook-request";
import { Patient } from "../../../domain/medical/patient";
import { processPatientDocumentRequest } from "./document-webhook";
import { MAPIWebhookStatus } from "./document-webhook";
import { getAllDocRefMapping } from "../docref-mapping/get-docref-mapping";
import { getDocuments } from "../../../external/fhir/document/get-documents";
import { toDTO, DocumentReferenceDTO } from "../../../routes/medical/dtos/documentDTO";
import { getAllWebhookRequestByRequestId } from "../../webhook/webhook-request";
import { Config } from "../../../shared/config";

const { log } = out(`Doc Query Webhook`);
const isSandbox = Config.isSandbox();

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

    await handleDownloadWebhook(webhooks, patient, requestId, documentQueryProgress);
    await handleConversionWebhook(webhooks, patient, requestId, documentQueryProgress);
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
  webhooks: WebhookRequest[],
  patient: Pick<Patient, "id" | "cxId" | "externalId">,
  requestId: string,
  documentQueryProgress: DocumentQueryProgress
): Promise<void> => {
  const downloadWebhookType = "medical.document-download";
  const downloadStatus = documentQueryProgress.download?.status;
  const isDownloadFinished = downloadStatus === "completed" || downloadStatus === "failed";
  const downloadWebhookSent = webhooks.some(webhook => webhook.type === downloadWebhookType);

  const canProcessRequest = isDownloadFinished && !downloadWebhookSent;

  if (canProcessRequest && !isSandbox) {
    const downloadIsCompleted = downloadStatus === "completed";
    const payload = await composeDocRefPayload(patient.id, patient.cxId, requestId);

    processPatientDocumentRequest(
      patient.cxId,
      patient.id,
      downloadWebhookType,
      downloadIsCompleted ? MAPIWebhookStatus.completed : MAPIWebhookStatus.failed,
      requestId,
      downloadIsCompleted ? payload : undefined
    );
  }
};

const handleConversionWebhook = async (
  webhooks: WebhookRequest[],
  patient: Pick<Patient, "id" | "cxId" | "externalId">,
  requestId: string,
  documentQueryProgress: DocumentQueryProgress
): Promise<void> => {
  const convertWebhookType = "medical.document-conversion";
  const convertStatus = documentQueryProgress.convert?.status;
  const isConvertFinished = convertStatus === "completed" || convertStatus === "failed";
  const convertWebhookSent = webhooks.some(webhook => webhook.type === convertWebhookType);

  console.log("CONVERT", convertStatus, convertWebhookSent, isConvertFinished, isSandbox);

  const canProcessRequest = isConvertFinished && !convertWebhookSent;

  if (canProcessRequest) {
    const convertIsCompleted = convertStatus === "completed";

    processPatientDocumentRequest(
      patient.cxId,
      patient.id,
      convertWebhookType,
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
