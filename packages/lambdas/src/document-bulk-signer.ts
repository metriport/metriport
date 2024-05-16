import * as Sentry from "@sentry/serverless";
import { getEnvOrFail, getEnv } from "./shared/env";
import { getEnvType } from "@metriport/core/util/env-var";
import {
  getSignedUrls,
  DocumentBulkSignerLambdaRequest,
} from "@metriport/core/external/aws/document-signing/bulk-sign";
import { capture } from "./shared/capture";

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");

const apiURL = getEnvOrFail("API_URL");
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

export const handler = Sentry.AWSLambda.wrapHandler(
  async (req: DocumentBulkSignerLambdaRequest) => {
    const { patientId, cxId, requestId } = req;
    capture.setExtra({ lambdaName: lambdaName });
    console.log(
      `Running with envType: ${getEnvType()}, region: ${region}, ` +
        `bucketName: ${bucketName}, cxId: ${cxId}, patientId: ${patientId}, requestId: ${requestId} `
    );

    await getSignedUrls(cxId, patientId, requestId, bucketName, region, apiURL);
  }
);
