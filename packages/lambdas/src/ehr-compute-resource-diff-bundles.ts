import { ComputeResourceDiffBundlesRequest } from "@metriport/core/external/ehr/bundle/job/create-resource-diff-bundles/steps/compute/ehr-compute-resource-diff-bundles";
import { EhrComputeResourceDiffBundlesLocal } from "@metriport/core/external/ehr/bundle/job/create-resource-diff-bundles/steps/compute/ehr-compute-resource-diff-bundles-local";
import { MetriportError } from "@metriport/shared";
import { supportedResourceTypes } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "./shared/capture";
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

export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  const startedAt = new Date().getTime();
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const parsedBody = parseBody(message.body);
  const {
    ehr,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    contribute,
    jobId,
    resourceType,
  } = parsedBody;

  const log = prefixedLog(
    `ehr ${ehr}, cxId ${cxId}, practiceId ${practiceId}, metriportPatientId ${metriportPatientId}, ehrPatientId ${ehrPatientId}, resourceType ${resourceType}, contribute ${contribute}, jobId ${jobId}`
  );

  const receiveCount = parseInt(message.attributes.ApproximateReceiveCount);
  const reportError = receiveCount >= maxAttempts;
  log(`Receive count: ${receiveCount}, max attempts: ${maxAttempts}, reportError: ${reportError}`);

  const ehrComputeResourceDiffHandler = new EhrComputeResourceDiffBundlesLocal(waitTimeInMillis);
  await ehrComputeResourceDiffHandler.computeResourceDiffBundles([{ ...parsedBody, reportError }]);

  const finishedAt = new Date().getTime();
  log(`Done local duration: ${finishedAt - startedAt}ms`);
});

const ehrComputeResourceDiffBundlesSchema = z.object({
  ehr: z.nativeEnum(EhrSources),
  cxId: z.string(),
  practiceId: z.string(),
  metriportPatientId: z.string(),
  ehrPatientId: z.string(),
  contribute: z.boolean().optional(),
  jobId: z.string(),
  resourceType: z.enum(supportedResourceTypes),
});

function parseBody(body?: unknown): ComputeResourceDiffBundlesRequest {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return ehrComputeResourceDiffBundlesSchema.parse(bodyAsJson);
}
