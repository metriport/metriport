import { EhrComputeResourceDiffBundlesDirect } from "@metriport/core/external/ehr/job/create-resource-diff-bundles/steps/compute/ehr-compute-resource-diff-bundles-direct";
import { MetriportError } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { capture } from "../shared/capture";
import { ehrCreateResourceDiffBundlesSchema } from "../shared/ehr";
import { getEnvOrFail } from "../shared/env";
import { prefixedLog } from "../shared/log";
import { parseBody } from "../shared/parse-body";
import { getSingleMessageOrFail } from "../shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const waitTimeInMillisRaw = getEnvOrFail("WAIT_TIME_IN_MILLIS");
const waitTimeInMillis = parseInt(waitTimeInMillisRaw);
const maxAttemptsRaw = getEnvOrFail("MAX_ATTEMPTS");
const maxAttempts = parseInt(maxAttemptsRaw);

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  if (isNaN(waitTimeInMillis)) {
    throw new MetriportError(`Invalid WAIT_TIME_IN_MILLIS: ${waitTimeInMillisRaw}`);
  }
  if (isNaN(maxAttempts)) {
    throw new MetriportError(`Invalid MAX_ATTEMPTS: ${maxAttemptsRaw}`);
  }

  const startedAt = new Date().getTime();
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const parsedBody = parseBody(ehrCreateResourceDiffBundlesSchema, message.body);
  const { metriportPatientId, ehrPatientId, jobId } = parsedBody;

  const log = prefixedLog(
    `metriportPatientId ${metriportPatientId}, ehrPatientId ${ehrPatientId}, jobId ${jobId}`
  );

  const receiveCount = parseInt(message.attributes.ApproximateReceiveCount);
  const reportError = receiveCount >= maxAttempts;
  log(`Receive count: ${receiveCount}, max attempts: ${maxAttempts}, reportError: ${reportError}`);

  const ehrComputeResourceDiffHandler = new EhrComputeResourceDiffBundlesDirect(waitTimeInMillis);
  await ehrComputeResourceDiffHandler.computeResourceDiffBundles({ ...parsedBody, reportError });

  const finishedAt = new Date().getTime();
  log(`Done local duration: ${finishedAt - startedAt}ms`);
});
