import { ComputeResourceDiffRequest } from "@metriport/core/external/ehr/resource-diff/steps/compute/ehr-compute-resource-diff";
import { EhrComputeResourceDiffLocal } from "@metriport/core/external/ehr/resource-diff/steps/compute/ehr-compute-resource-diff-local";
import { MetriportError } from "@metriport/shared";
import { fhirResourceSchema } from "@metriport/shared/interface/external/ehr/fhir-resource";
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

export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  const startedAt = new Date().getTime();
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const parsedBody = parseBody(message.body);
  const { ehr, cxId, practiceId, metriportPatientId, ehrPatientId, newResource } = parsedBody;

  const log = prefixedLog(
    `ehr ${ehr}, cxId ${cxId}, practiceId ${practiceId}, metriportPatientId ${metriportPatientId}, ehrPatientId ${ehrPatientId}, resourceId ${newResource.id}`
  );
  log(`Parsed: ${JSON.stringify(parsedBody)}, waitTimeInMillis ${waitTimeInMillis}`);

  const ehrComputeResourceDiffHandler = new EhrComputeResourceDiffLocal(waitTimeInMillis);
  await ehrComputeResourceDiffHandler.computeResourceDiff([parsedBody]);

  const finishedAt = new Date().getTime();
  log(`Done local duration: ${finishedAt - startedAt}ms`);
});

const ehrComputeResourceDiffSchema = z.object({
  ehr: z.nativeEnum(EhrSources),
  cxId: z.string(),
  practiceId: z.string(),
  metriportPatientId: z.string(),
  ehrPatientId: z.string(),
  existingResources: fhirResourceSchema.array().optional(),
  newResource: fhirResourceSchema,
  requestId: z.string(),
  workflowId: z.string(),
});

function parseBody(body?: unknown): ComputeResourceDiffRequest {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return ehrComputeResourceDiffSchema.parse(bodyAsJson);
}
