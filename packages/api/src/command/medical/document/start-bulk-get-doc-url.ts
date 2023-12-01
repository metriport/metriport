import { Config } from "../../../shared/config";
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
import { makeLambdaClient } from "../../../external/aws/lambda";
import { DocumentBulkSignerLambdaRequest } from "@metriport/core/external/aws/lambda-logic/document-bulk-signing";

const lambdaClient = makeLambdaClient();
const bulkSigningLambdaName = Config.getBulkUrlSigningLambdaName();

/**
 * The function `startBulkGetDocumentUrls` triggers the bulk signing process lambda for a patient's documents and
 * returns the progress of the bulk signing.
 * @param {string} cxId - cxId
 * @param {string} patientId - patientId
 * @returns a Promise that resolves to a BulkGetDocumentsUrlProgress object.
 */
export const startBulkGetDocumentUrls = async (
  cxId: string,
  patientId: string
): Promise<BulkGetDocumentsUrlProgress> => {
  const { log } = Util.out(`triggerBulkSigning - M patient ${patientId}`);
  if (!bulkSigningLambdaName) throw new Error("Bulk Signing Lambda Name is undefined");
  const patient = await getPatientOrFail({ id: patientId, cxId });

  const bulkGetDocUrlProgress = patient.data.bulkGetDocumentsUrlProgress;

  if (isBulkGetDocUrlProcessing(bulkGetDocUrlProgress?.urlGeneration)) {
    log(
      `Patient ${patientId}, Request ${bulkGetDocUrlProgress?.requestId}, bulkGetDocUrlProgress is already 'processing', skipping...`
    );
    return createBulkGetDocumentUrlQueryResponse("processing", patient);
  }

  const requestId = getOrGenerateRequestId(bulkGetDocUrlProgress);

  const updatedPatient = await storeBulkGetDocumentUrlQueryInit({
    id: patient.id,
    cxId: patient.cxId,
    bulkGetDocumentsUrlProgress: { urlGeneration: { status: "processing" } },
    requestId,
  });

  // getSignedUrls(
  //     cxId,
  //     patientId,
  //     requestId,
  //     "medical-documents-staging",
  //     "us-east-2",
  //     "http://localhost:8080",
  //   )

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
  } catch (e) {
    console.log("Lambda error:", e);
  }

  return createBulkGetDocumentUrlQueryResponse("processing", updatedPatient);
};

/**
 * The function `getOrGenerateRequestId` returns the request ID from `docBulkDownloadProgress` if it
 * exists, otherwise it generates a new request ID.
 * @param {BulkGetDocumentsUrlProgress | undefined} BulkGetDocumentsUrlProgress - Represents the document url getting progress.
 * @returns a string representing the request ID.
 */

export function getOrGenerateRequestId(
  bulkGetDocumentsUrlProgress: BulkGetDocumentsUrlProgress | undefined
): string {
  if (
    isBulkGetDocUrlProcessing(bulkGetDocumentsUrlProgress?.urlGeneration) &&
    bulkGetDocumentsUrlProgress?.requestId
  ) {
    return bulkGetDocumentsUrlProgress.requestId;
  }

  return generateRequestId();
}

const generateRequestId = (): string => uuidv7();

/**
 * The function creates a response object for a bulk get documents urls query with a given status and patient
 * information.
 * @param {BulkGetDocUrlStatus} status - The the status of the bulk get documents url .
 * @param {Patient} [patient] - The the patient for whom the `BulkGetDocumentsUrlProgress` is being created.
 * @returns a BulkGetDocumentsUrlProgress object.
 */
export const createBulkGetDocumentUrlQueryResponse = (
  status: BulkGetDocUrlStatus,
  patient?: Patient
): BulkGetDocumentsUrlProgress => {
  return {
    urlGeneration: {
      status,
      ...patient?.data.bulkGetDocumentsUrlProgress?.urlGeneration,
    },
    ...patient?.data.bulkGetDocumentsUrlProgress,
  };
};
