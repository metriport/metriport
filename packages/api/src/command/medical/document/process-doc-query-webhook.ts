import { errorToString } from "@metriport/core/util/error/index";
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import { ProgressType, DocumentQueryStatus } from "@metriport/core/domain/document-query";
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
type WebhookType = typeof DOWNLOAD_WEBHOOK_TYPE | typeof CONVERSION_WEBHOOK_TYPE;

export const handleWebhookBeingSent = async ({
  patient,
  requestId,
}: {
  patient: Patient;
  requestId: string;
}) => {
  const downloadStatus = patient.data?.documentQueryProgress?.download?.status;
  const convertStatus = patient.data?.documentQueryProgress?.convert?.status;

  const isDownloadFinished = downloadStatus === "completed" || downloadStatus === "failed";
  const isConvertFinished = convertStatus === "completed" || convertStatus === "failed";

  if (isDownloadFinished) {
    await processDocQueryProgressWebhook({
      patient,
      requestId,
      progressType: "download",
      status: downloadStatus,
    });
  } else if (isConvertFinished) {
    await processDocQueryProgressWebhook({
      patient,
      requestId,
      progressType: "convert",
      status: convertStatus,
    });
  }
};

/**
 * Processes the document query progress to determine if when to send the document download and conversion webhooks
 */
export const processDocQueryProgressWebhook = async ({
  patient,
  requestId,
  progressType,
  status,
}: {
  patient: Pick<Patient, "id" | "cxId" | "externalId">;
  requestId: string;
  progressType: ProgressType;
  status: DocumentQueryStatus;
}): Promise<void> => {
  const { id: patientId } = patient;

  try {
    const webhooks = await getAllWebhookRequestByRequestId(requestId);
    const webhookSet = new Set(webhooks.map(webhook => webhook.type));

    if (progressType === "convert") {
      handleWebhook({
        patient,
        requestId,
        webhookType: CONVERSION_WEBHOOK_TYPE,
        docQueryStatus: status,
        webhookSent: webhookSet.has(CONVERSION_WEBHOOK_TYPE),
      });
    } else if (progressType === "download") {
      if (!isSandbox) {
        const payload = await composeDocRefPayload(patient.id, patient.cxId, requestId);
        handleWebhook({
          patient,
          requestId,
          webhookType: DOWNLOAD_WEBHOOK_TYPE,
          docQueryStatus: status,
          webhookSent: webhookSet.has(DOWNLOAD_WEBHOOK_TYPE),
          payload,
        });
      }
    }
  } catch (error) {
    const msg = `Error on processDocQueryDownloadProgressWebhook`;
    const extra = {
      requestId,
      patientId,
      msg,
      context: `webhook.processDocQueryDownloadProgressWebhook`,
      error,
    };

    log(`${msg}: ${errorToString(error)} - ${JSON.stringify(extra)}`);
    capture.error(error, { extra });
  }
};

const handleWebhook = async ({
  patient,
  requestId,
  webhookType,
  docQueryStatus,
  webhookSent,
  payload,
}: {
  patient: Pick<Patient, "id" | "cxId" | "externalId">;
  requestId: string;
  docQueryStatus: DocumentQueryStatus;
  webhookType: WebhookType;
  webhookSent: boolean;
  payload?: DocumentReferenceDTO[];
}) => {
  if (webhookSent) {
    return;
  }

  const isComplete = docQueryStatus === "completed";

  processPatientDocumentRequest(
    patient.cxId,
    patient.id,
    webhookType,
    isComplete ? MAPIWebhookStatus.completed : MAPIWebhookStatus.failed,
    requestId,
    isComplete && payload ? payload : undefined
  );
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
