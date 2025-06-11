import { RunJobRequest } from "@metriport/core/command/job/patient/jobs/start-jobs/steps/run/run-job";
import { RunJobDirect } from "@metriport/core/command/job/patient/jobs/start-jobs/steps/run/run-job-direct";
import { MetriportError } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../../shared/capture";
import { getEnvOrFail } from "../../shared/env";
import { prefixedLog } from "../../shared/log";
import { getSingleMessageOrFail } from "../../shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  const startedAt = new Date().getTime();
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const parsedBody = parseBody(message.body);
  const { id, cxId, jobType } = parsedBody;
  const log = prefixedLog(`id ${id}, cxId ${cxId}, jobType ${jobType}`);

  const runJobHandler = new RunJobDirect();
  await runJobHandler.runJob(parsedBody);

  const finishedAt = new Date().getTime();
  log(`Done local duration: ${finishedAt - startedAt}ms`);
});

export const runJobSchema = z.object({
  id: z.string(),
  cxId: z.string(),
  jobType: z.string(),
  paramsCx: z.record(z.string(), z.string().or(z.boolean())).optional(),
  paramsOps: z.record(z.string(), z.string().or(z.boolean())).optional(),
  data: z.unknown(),
});

function parseBody(body?: unknown): RunJobRequest {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return runJobSchema.parse(bodyAsJson);
}
