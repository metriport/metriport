import {
  BulkGetDocumentsUrlProgress,
  isBulkGetDocUrlProcessing,
  BulkGetDocUrlStatus,
} from "../../../domain/medical/bulk-get-document-url";
import { Util } from "../../../shared/util";
import { getPatientOrFail } from "../patient/get-patient";
import { Patient } from "../../../domain/medical/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { storeBulkGetDocumentUrlQueryInit } from "../patient/bulk-get-doc-url-progress";
import { DocumentBulkSignerRequest } from "@metriport/core/external/aws/document-signing/document-bulk-signer";
import { makeDocumentBulkSigner } from "../../../external/aws/document-bulk-signer-factory";
import { appendBulkGetDocUrlProgress } from "../patient/bulk-get-doc-url-progress";
import { capture } from "@metriport/core/util/capture";

/**
 * The function `startBulkGetDocumentUrls` triggers the bulk signing process lambda for a patient's documents and
 * returns the progress of the bulk signing.
 * @param cxId - cxId
 * @param patientId - patientId
 * @returns a Promise that resolves to a BulkGetDocumentsUrlProgress object.
 */
export const startBulkGetDocumentUrls = async (
  cxId: string,
  patientId: string
): Promise<BulkGetDocumentsUrlProgress> => {
  const { log } = Util.out(`startBulkGetDocumentUrls - M patient ${patientId}`);
  const patient = await getPatientOrFail({ id: patientId, cxId });

  const bulkGetDocUrlProgress = patient.data.bulkGetDocumentsUrlProgress;

  if (isBulkGetDocUrlProcessing(bulkGetDocUrlProgress?.status)) {
    log(
      `Patient ${patientId}, Request ${bulkGetDocUrlProgress?.requestId}, bulkGetDocUrlProgress is already 'processing', skipping...`
    );
    return createBulkGetDocumentUrlQueryResponse(BulkGetDocUrlStatus.processing, patient);
  }

  const requestId = getOrGenerateRequestId(bulkGetDocUrlProgress);

  const updatedPatient = await storeBulkGetDocumentUrlQueryInit({
    id: patient.id,
    cxId: patient.cxId,
    status: BulkGetDocUrlStatus.processing,
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
      status: BulkGetDocUrlStatus.failed,
      requestId: requestId,
    });
    capture.error(error, {
      extra: { patientId, context: `startBulkGetDocumentUrls`, error },
    });
    return createBulkGetDocumentUrlQueryResponse(BulkGetDocUrlStatus.failed, updatedPatient);
  }

  return createBulkGetDocumentUrlQueryResponse(BulkGetDocUrlStatus.processing, updatedPatient);
};

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
export const createBulkGetDocumentUrlQueryResponse = (
  status: BulkGetDocUrlStatus,
  patient: Patient
): BulkGetDocumentsUrlProgress => {
  return {
    status,
    requestId: patient.data.bulkGetDocumentsUrlProgress?.requestId,
  };
};
