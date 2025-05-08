import { RefreshEhrBundlesRequest } from "@metriport/core/external/ehr/bundle/job/refresh-ehr-bundles/ehr-refresh-ehr-bundles";
import { EhrRefreshEhrBundlesLocal } from "@metriport/core/external/ehr/bundle/job/refresh-ehr-bundles/ehr-refresh-ehr-bundles-local";
import { MetriportError } from "@metriport/shared";
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

  console.log(`Running with unparsed body: ${message.body}`);
  const parsedBody = parseBody(message.body);
  const { ehr, cxId, practiceId, patientId, jobId } = parsedBody;

  const log = prefixedLog(
    `ehr ${ehr}, cxId ${cxId}, practiceId ${practiceId}, patientId ${patientId}, jobId ${jobId}`
  );
  log(`Parsed: ${JSON.stringify(parsedBody)}, waitTimeInMillis ${waitTimeInMillis}`);

  const ehrRefreshEhrBundlesHandler = new EhrRefreshEhrBundlesLocal(waitTimeInMillis);
  await ehrRefreshEhrBundlesHandler.refreshEhrBundles(parsedBody);

  const finishedAt = new Date().getTime();
  log(`Done local duration: ${finishedAt - startedAt}ms`);
});

const ehrRefreshEhrBundlesSchema = z.object({
  ehr: z.nativeEnum(EhrSources),
  cxId: z.string(),
  practiceId: z.string(),
  patientId: z.string(),
  jobId: z.string(),
});

function parseBody(body?: unknown): RefreshEhrBundlesRequest {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return ehrRefreshEhrBundlesSchema.parse(bodyAsJson);
}
