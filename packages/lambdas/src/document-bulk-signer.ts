import {
  DocumentBulkSignerLambdaRequest,
  searchDocumentsSignUrlsAndSendToApi,
} from "@metriport/core/external/aws/document-signing/bulk-sign";
import { getEnvType } from "@metriport/core/util/env-var";
import { getEnvVar, getEnvVarOrFail } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";

// Automatically set by AWS
const lambdaName = getEnvVar("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvVarOrFail("AWS_REGION");

const apiURL = getEnvVarOrFail("API_URL");
const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(
  async (req: DocumentBulkSignerLambdaRequest) => {
    const { patientId, cxId, requestId } = req;
    capture.setExtra({ lambdaName: lambdaName });
    console.log(
      `Running with envType: ${getEnvType()}, region: ${region}, ` +
        `bucketName: ${bucketName}, cxId: ${cxId}, patientId: ${patientId}, requestId: ${requestId} `
    );

    await searchDocumentsSignUrlsAndSendToApi(
      cxId,
      patientId,
      requestId,
      bucketName,
      region,
      apiURL
    );
  }
);
