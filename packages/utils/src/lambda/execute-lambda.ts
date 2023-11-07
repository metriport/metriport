import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ConversionType, Input } from "@metriport/core/domain/conversion/cda-to-html-pdf";
import {
  getLambdaError,
  isLambdaError,
  logResultToString,
  makeLambdaClient,
} from "@metriport/core/external/aws/lambda";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { MetriportError } from "@metriport/core/util/error/metriport-error";

/**
 * Script to execute the CdaToVisualization lambda.
 *
 * Update the constants below and run this script to execute the lambda.
 */

// UPDATE THESE
const s3Key = ""; // filename
const conversionType: ConversionType = "pdf";

// LIKELY DON'T NEED TO UPDATE THESE
const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const lambdaName = "CdaToVisualizationLambda";

const lambdaClient = makeLambdaClient(region);

const payload: Input = {
  fileName: s3Key,
  bucketName,
  conversionType,
};

async function main() {
  const lambdaResult = await lambdaClient
    .invoke({
      FunctionName: lambdaName,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(payload),
    })
    .promise();

  if (lambdaResult.StatusCode !== 200) {
    throw new MetriportError("Lambda invocation failed", undefined, {
      lambdaName,
      status: lambdaResult.StatusCode,
      log: logResultToString(lambdaResult.LogResult),
      payload: lambdaResult.Payload?.toString(),
    });
  }
  if (!lambdaResult.Payload) {
    throw new MetriportError("Payload is undefined", undefined, {
      lambdaName,
      status: lambdaResult.StatusCode,
      log: logResultToString(lambdaResult.LogResult),
    });
  }

  if (isLambdaError(lambdaResult)) {
    console.log(
      `Error calling lambda ${lambdaName}: ${JSON.stringify(getLambdaError(lambdaResult), null, 2)}`
    );
    return;
  }

  const response = JSON.parse(lambdaResult.Payload.toString());

  const url = response.url;
  console.log(`URL: '${url}'`);
}

main();
