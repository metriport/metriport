import { ComputeResourceDiffBundlesRequest } from "@metriport/core/external/ehr/jobs/create-resource-diff-bundles/steps/compute/ehr-compute-resource-diff-bundles";
import { EhrComputeResourceDiffBundlesLocal } from "@metriport/core/external/ehr/jobs/create-resource-diff-bundles/steps/compute/ehr-compute-resource-diff-bundles-local";
import { MetriportError } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { ehrCreateResourceDiffBundlesSchema } from "./shared/ehr";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { getSingleMessageOrFail } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const waitTimeInMillisRaw = getEnvOrFail("WAIT_TIME_IN_MILLIS");
const waitTimeInMillis = parseInt(waitTimeInMillisRaw);
const maxAttemptsRaw = getEnvOrFail("MAX_ATTEMPTS");
const maxAttempts = parseInt(maxAttemptsRaw);

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  const startedAt = new Date().getTime();
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  console.log(`Running with unparsed body: ${message.body}`);
  const parsedBody = parseBody(message.body);
  const { metriportPatientId, ehrPatientId, jobId } = parsedBody;

  const log = prefixedLog(
    `metriportPatientId ${metriportPatientId}, ehrPatientId ${ehrPatientId}, jobId ${jobId}`
  );
  log(`Parsed: ${JSON.stringify(parsedBody)}, waitTimeInMillis ${waitTimeInMillis}`);

  const receiveCount = parseInt(message.attributes.ApproximateReceiveCount);
  const reportError = receiveCount >= maxAttempts;
  log(`Receive count: ${receiveCount}, max attempts: ${maxAttempts}, reportError: ${reportError}`);

  const ehrComputeResourceDiffHandler = new EhrComputeResourceDiffBundlesLocal(waitTimeInMillis);
  await ehrComputeResourceDiffHandler.computeResourceDiffBundles({ ...parsedBody, reportError });

  const finishedAt = new Date().getTime();
  log(`Done local duration: ${finishedAt - startedAt}ms`);
});

function parseBody(body?: unknown): ComputeResourceDiffBundlesRequest {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return ehrCreateResourceDiffBundlesSchema.parse(bodyAsJson);
}
