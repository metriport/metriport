import { Config } from "../../../shared/config";
import { searchDocuments } from "../../../external/fhir/document/search-documents";
import { chunk } from "lodash";
import { processPatientDocumentRequest, MAPIWebhookStatus } from "./document-webhook";
import {
  DocumentBulkDownloadDTO,
  toDTO,
} from "../../../routes/medical/dtos/document-bulk-downloadDTO";

import {
  DocumentBulkDownloadProgress,
  isDocBulkDownloadProcessing,
  DocumentDownloadStatus,
} from "../../../domain/medical/document-bulk-download";
import { getSignedUrls } from "@metriport/core/external/aws/lambda-logic/document-bulk-signing";
import { Util } from "../../../shared/util";
import { getPatientOrFail } from "../patient/get-patient";
import { Patient } from "../../../domain/medical/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { storeBulkDownloadQueryInit } from "../patient/query-init";
import { appendDocBulkDownloadProgress } from "../patient/append-bulk-doc-download-progress";
import { DocumentReference } from "@medplum/fhirtypes";
//import { makeLambdaClient } from "../../../external/aws/lambda";

const BATCH_SIZE = 1;
//const lambdaClient = makeLambdaClient();
const bulkSigningLambdaName = Config.getBulkUrlSigningLambdaName();

export const triggerBulkUrlSigning = async (
  cxId: string,
  patientId: string
): Promise<DocumentBulkDownloadProgress> => {
  if (!bulkSigningLambdaName) throw new Error("Bulk Signing Lambda Name is undefined");
  const { log } = Util.out(`triggerBulkSigning - M patient ${patientId}`);

  const patient = await getPatientOrFail({ id: patientId, cxId });

  const docBulkDownloadProgress = patient.data.documentBulkDownloadProgress;
  const requestId = getOrGenerateRequestId(docBulkDownloadProgress);

  if (isDocBulkDownloadProcessing(docBulkDownloadProgress?.download)) {
    log(
      `Patient ${patientId}, Request ${requestId}, docBulkDownloadProgress is already 'processing', skipping...`
    );
    return createQueryResponse("processing", patient);
  }

  const documents = await searchDocuments({ cxId, patientId });

  const updatedPatient = await storeBulkDownloadQueryInit({
    id: patient.id,
    cxId: patient.cxId,
    documentBulkDownloadProgress: { download: { status: "processing" } },
    requestId,
    totalDocuments: documents.length,
  });

  // sleep for 20 seconds to allow the webhook to be processed
  await new Promise(resolve => setTimeout(resolve, 30000));

  let successes = 0;
  const errors = 0;
  // Process each batch
  const batches = chunk(documents, BATCH_SIZE);
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex] as DocumentReference[];
    const dtos: DocumentBulkDownloadDTO[] = [];
    const payload = {
      filenames: batch
        .map(doc => {
          if (doc.content && doc.content[0] && doc.content[0].attachment) {
            return doc.content[0].attachment.title;
          }
          return undefined;
        })
        .filter((filename): filename is string => filename !== undefined),
    };

    // Invoke the lambda function
    // const result = await lambdaClient
    //   .invoke({
    //     FunctionName: bulkSigningLambdaName,
    //     InvocationType: "RequestResponse",
    //     Payload: JSON.stringify(payload),
    //   })
    //   .promise();

    // const resultPayload = getLambdaResultPayload({ result, lambdaName: bulkSigningLambdaName });
    // const parsedResult = JSON.parse(resultPayload);

    const parsedResult: string[] = await getSignedUrls(
      payload.filenames,
      Config.getMedicalDocumentsBucketName(),
      "us-east-2"
    );
    console.log("Parsed Result", parsedResult);

    // Create DTOs for each signed URL
    for (let i = 0; i < parsedResult.length; i++) {
      const signedUrl = parsedResult[i];
      const doc = batch[i];
      if (signedUrl) {
        const dto = toDTO(doc, signedUrl);
        if (dto) {
          dtos.push(dto);
        }
        successes++;
      }
    }

    const isLastBatch = batchIndex === batches.length - 1;
    const status = isLastBatch ? "completed" : "processing";

    appendDocBulkDownloadProgress({
      patient,
      successful: successes,
      errors,
      status: status,
      requestId,
    });

    // trigger the webhook
    processPatientDocumentRequest(
      cxId,
      patientId,
      "medical.document-bulk-download",
      MAPIWebhookStatus.completed,
      dtos
    );
  }
  return createQueryResponse("processing", updatedPatient);
};

/**
 * Returns the existing request ID if the previous query has not been entirely completed. Otherwise, returns a newly-generated request ID.
 *
 * @param DocumentBulkDownloadProgress Progress of the previous query
 * @returns uuidv7 string ID for the request
 */
export function getOrGenerateRequestId(
  docBulkDownloadProgress: DocumentBulkDownloadProgress | undefined
): string {
  if (
    isDocBulkDownloadProcessing(docBulkDownloadProgress?.download) &&
    docBulkDownloadProgress?.requestId
  ) {
    return docBulkDownloadProgress.requestId;
  }

  return generateRequestId();
}

const generateRequestId = (): string => uuidv7();

export const createQueryResponse = (
  status: DocumentDownloadStatus,
  patient?: Patient
): DocumentBulkDownloadProgress => {
  return {
    download: {
      status,
      ...patient?.data.documentBulkDownloadProgress?.download,
    },
    ...patient?.data.documentBulkDownloadProgress,
  };
};
