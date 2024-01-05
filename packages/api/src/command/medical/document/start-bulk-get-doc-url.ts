import {
  BulkGetDocumentsUrlProgress,
  isBulkGetDocUrlProcessing,
  BulkGetDocUrlStatus,
} from "@metriport/core/domain/medical/bulk-get-document-url";
import { Util } from "../../../shared/util";
import { getPatientOrFail } from "../patient/get-patient";
import { Patient } from "@metriport/core/domain/medical/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { storeBulkGetDocumentUrlQueryInit } from "../patient/bulk-get-doc-url-progress";
import { makeLambdaClient } from "../../../external/aws/lambda";
import { DocumentBulkSignerLambdaRequest } from "@metriport/core/external/aws/lambda-logic/document-bulk-signing";
import { appendBulkGetDocUrlProgress } from "../patient/bulk-get-doc-url-progress";
import { capture } from "../../../shared/notifications";

const lambdaClient = makeLambdaClient();
const bulkSigningLambdaName = "BulkUrlSigningLambda";

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
  if (!bulkSigningLambdaName) throw new Error("Bulk Signing Lambda Name is undefined");
  const patient = await getPatientOrFail({ id: patientId, cxId });

  const bulkGetDocUrlProgress = patient.data.bulkGetDocumentsUrlProgress;

  if (isBulkGetDocUrlProcessing(bulkGetDocUrlProgress?.status)) {
    log(
      `Patient ${patientId}, Request ${bulkGetDocUrlProgress?.requestId}, bulkGetDocUrlProgress is already 'processing', skipping...`
    );
    return createBulkGetDocumentUrlQueryResponse("processing", patient);
  }

  const requestId = getOrGenerateRequestId(bulkGetDocUrlProgress);

  const updatedPatient = await storeBulkGetDocumentUrlQueryInit({
    id: patient.id,
    cxId: patient.cxId,
    bulkGetDocumentsUrlProgress: { status: "processing" },
    requestId,
  });

  const payload: DocumentBulkSignerLambdaRequest = {
    patientId: patientId,
    cxId: cxId,
    requestId: requestId,
  };

  try {
    lambdaClient
      .invoke({
        FunctionName: bulkSigningLambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(payload),
      })
      .promise();
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
  patient?: Patient
): BulkGetDocumentsUrlProgress => {
  return {
    status,
    requestId: patient?.data.bulkGetDocumentsUrlProgress?.requestId,
  };
};
