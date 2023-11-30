import * as Sentry from "@sentry/serverless";
import { getEnvOrFail, getEnv } from "./shared/env";
import { getEnvType } from "@metriport/core/util/env-var";
import {
  getSignedUrls,
  DocumentBulkSignerLambdaRequest,
  DocumentBulkSignerLambdaResponse,
} from "@metriport/core/external/aws/lambda-logic/document-bulk-signing";
import { capture } from "./shared/capture";

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");

const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

export const handler = Sentry.AWSLambda.wrapHandler(
  async (req: DocumentBulkSignerLambdaRequest): Promise<DocumentBulkSignerLambdaResponse[]> => {
    const { patientId, cxId, documents } = req;

    capture.setExtra({ lambdaName: lambdaName });
    console.log(
      `Running with envType: ${getEnvType()}, region: ${region}, ` +
        `bucketName: ${bucketName}, cxId: ${cxId}, patientId: ${patientId} `
    );

    const response: DocumentBulkSignerLambdaResponse[] = await getSignedUrls(
      documents,
      bucketName,
      region
    );
    return response;
  }
);
