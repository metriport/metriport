import {
  BulkGetDocumentsUrlProgress,
  BulkGetDocUrlStatus,
  isBulkGetDocUrlProcessing,
} from "@metriport/core/domain/bulk-get-document-url";
import { Patient } from "@metriport/core/domain/patient";
import { DocumentBulkSignerRequest } from "@metriport/core/external/aws/document-signing/document-bulk-signer";
import { out } from "@metriport/core/util";
import { capture } from "@metriport/core/util/notifications";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { makeDocumentBulkSigner } from "../../../external/aws/document-bulk-signer-factory";
import {
  appendBulkGetDocUrlProgress,
  storeBulkGetDocumentUrlQueryInit,
} from "../patient/bulk-get-doc-url-progress";
import { getPatientOrFail } from "../patient/get-patient";

/**
 * The function `startBulkGetDocumentUrls` triggers the bulk signing process lambda for a patient's documents and
 * returns the progress of the bulk signing.
 * @param cxId - cxId
 * @param patientId - patientId
 * @param continueProcessingRequest - if true, continue an existing processing request
 * @returns a Promise that resolves to a BulkGetDocumentsUrlProgress object.
 */
export async function startBulkGetDocumentUrls({
  cxId,
  patientId,
  cxDownloadRequestMetadata,
  continueProcessingRequest = false,
}: {
  cxId: string;
  patientId: string;
  cxDownloadRequestMetadata: unknown;
  continueProcessingRequest?: boolean;
}): Promise<BulkGetDocumentsUrlProgress> {
  const { log } = out(`startBulkGetDocumentUrls - M patient ${patientId}`);
  const patient = await getPatientOrFail({ id: patientId, cxId });

  const bulkGetDocUrlProgress = patient.data.bulkGetDocumentsUrlProgress;

  if (!continueProcessingRequest && isBulkGetDocUrlProcessing(bulkGetDocUrlProgress?.status)) {
    log(
      `Patient ${patientId}, Request ${bulkGetDocUrlProgress?.requestId}, bulkGetDocUrlProgress is already 'processing', skipping...`
    );
    return createBulkGetDocumentUrlQueryResponse("processing", patient);
  } else if (
    continueProcessingRequest &&
    !isBulkGetDocUrlProcessing(bulkGetDocUrlProgress?.status)
  ) {
    throw new BadRequestError(`No processing request found for patient ${patientId}`, undefined, {
      patientId,
      cxId,
    });
  }

  const requestId = getOrGenerateRequestId(bulkGetDocUrlProgress);

  const updatedPatient = await storeBulkGetDocumentUrlQueryInit({
    id: patient.id,
    cxId: patient.cxId,
    bulkGetDocumentsUrlProgress: { status: "processing" },
    cxDownloadRequestMetadata,
    requestId,
  });

  const payload: DocumentBulkSignerRequest = {
    patientId: patientId,
    cxId: cxId,
    requestId: requestId,
  };

  const documentBulkSigner = makeDocumentBulkSigner();

  try {
    documentBulkSigner.sign(payload);
  } catch (error) {
    appendBulkGetDocUrlProgress({
      patient: { id: patientId, cxId: cxId },
      status: "failed",
      requestId: requestId,
    });
    capture.error(error, {
      extra: { patientId, context: `startBulkGetDocumentUrls`, error },
    });
    return createBulkGetDocumentUrlQueryResponse("failed", updatedPatient);
  }

  return createBulkGetDocumentUrlQueryResponse("processing", updatedPatient);
}

/**
 * The function `getOrGenerateRequestId` returns the request ID from `bulkGetDocumentsUrlProgress` if it
 * exists, otherwise it generates a new request ID.
 * @param bulkGetDocumentsUrlProgress - Represents the document URL getting progress.
 * @returns a string representing the request ID.
 */
export function getOrGenerateRequestId(
  bulkGetDocumentsUrlProgress: BulkGetDocumentsUrlProgress | undefined
): string {
  if (
    isBulkGetDocUrlProcessing(bulkGetDocumentsUrlProgress?.status) &&
    bulkGetDocumentsUrlProgress?.requestId
  ) {
    return bulkGetDocumentsUrlProgress.requestId;
  }

  return generateRequestId();
}

const generateRequestId = (): string => uuidv7();

/**
 * The function creates a response object for a bulk get documents URLs query with a given status and patient
 * information.
 * @param status - The status of the bulk get documents URLs.
 * @param patient - The patient for whom the `BulkGetDocumentsUrlProgress` is being created.
 * @returns a BulkGetDocumentsUrlProgress object.
 */
export function createBulkGetDocumentUrlQueryResponse(
  status: BulkGetDocUrlStatus,
  patient?: Patient
): BulkGetDocumentsUrlProgress {
  return {
    status,
    requestId: patient?.data.bulkGetDocumentsUrlProgress?.requestId,
  };
}
