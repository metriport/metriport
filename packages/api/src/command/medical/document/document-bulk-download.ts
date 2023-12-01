import { Config } from "../../../shared/config";
import {
  DocumentBulkDownloadProgress,
  isDocBulkDownloadProcessing,
  DocumentDownloadStatus,
} from "../../../domain/medical/document-bulk-download";
//import { getSignedUrls } from "@metriport/core/external/aws/lambda-logic/document-bulk-signing";
import { Util } from "../../../shared/util";
import { getPatientOrFail } from "../patient/get-patient";
import { Patient } from "../../../domain/medical/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { storeBulkDownloadQueryInit } from "../patient/bulk-doc-download-progress";
import { makeLambdaClient } from "../../../external/aws/lambda";
import { DocumentBulkSignerLambdaRequest } from "@metriport/core/external/aws/lambda-logic/document-bulk-signing";

const lambdaClient = makeLambdaClient();
const bulkSigningLambdaName = Config.getBulkUrlSigningLambdaName();

/**
 * The function `triggerBulkUrlSigning` triggers the bulk signing process lambda for a patient's documents and
 * returns the progress of the bulk download. It also triggers the webhook for the bulk download.
 * @param {string} cxId - cxId
 * @param {string} patientId - patientId
 * @returns a Promise that resolves to a DocumentBulkDownloadProgress object.
 */
export const startBulkGetDocumentUrls = async (
  cxId: string,
  patientId: string
): Promise<DocumentBulkDownloadProgress> => {
  const { log } = Util.out(`triggerBulkSigning - M patient ${patientId}`);
  if (!bulkSigningLambdaName) throw new Error("Bulk Signing Lambda Name is undefined");
  const patient = await getPatientOrFail({ id: patientId, cxId });

  const docBulkDownloadProgress = patient.data.documentBulkDownloadProgress;

  if (isDocBulkDownloadProcessing(docBulkDownloadProgress?.urlGeneration)) {
    log(
      `Patient ${patientId}, Request ${docBulkDownloadProgress?.requestId}, docBulkDownloadProgress is already 'processing', skipping...`
    );
    return createBulkDownloadQueryResponse("processing", patient);
  }

  const requestId = getOrGenerateRequestId(docBulkDownloadProgress);

  const updatedPatient = await storeBulkDownloadQueryInit({
    id: patient.id,
    cxId: patient.cxId,
    documentBulkDownloadProgress: { urlGeneration: { status: "processing" } },
    requestId,
  });

  const payload: DocumentBulkSignerLambdaRequest = {
    patientId: patientId,
    cxId: cxId,
    requestId: requestId,
  };

  lambdaClient.invoke({
    FunctionName: bulkSigningLambdaName,
    InvocationType: "RequestResponse",
    Payload: JSON.stringify(payload),
  });

  return createBulkDownloadQueryResponse("processing", updatedPatient);
};

/**
 * The function `getOrGenerateRequestId` returns the request ID from `docBulkDownloadProgress` if it
 * exists, otherwise it generates a new request ID.
 * @param {DocumentBulkDownloadProgress | undefined} docBulkDownloadProgress - Represents the document download progress.
 * @returns a string representing the request ID.
 */

export function getOrGenerateRequestId(
  docBulkDownloadProgress: DocumentBulkDownloadProgress | undefined
): string {
  if (
    isDocBulkDownloadProcessing(docBulkDownloadProgress?.urlGeneration) &&
    docBulkDownloadProgress?.requestId
  ) {
    return docBulkDownloadProgress.requestId;
  }

  return generateRequestId();
}

const generateRequestId = (): string => uuidv7();

/**
 * The function creates a response object for a bulk download query with a given status and patient
 * information.
 * @param {DocumentDownloadStatus} status - The status parameter is of type DocumentDownloadStatus. It
 * represents the status of the document bulk download.
 * @param {Patient} [patient] - The `patient` parameter is an optional parameter of type `Patient`. It
 * represents the patient for whom the document bulk download progress is being created.
 * @returns a DocumentBulkDownloadProgress object.
 */
export const createBulkDownloadQueryResponse = (
  status: DocumentDownloadStatus,
  patient?: Patient
): DocumentBulkDownloadProgress => {
  return {
    urlGeneration: {
      status,
      ...patient?.data.documentBulkDownloadProgress?.urlGeneration,
    },
    ...patient?.data.documentBulkDownloadProgress,
  };
};
