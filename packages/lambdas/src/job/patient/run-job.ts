import { RunJobRequest } from "@metriport/core/command/job/patient/job/start-jobs/steps/run/run-job";
import { RunJobDirect } from "@metriport/core/command/job/patient/job/start-jobs/steps/run/run-job-direct";
import { MetriportError } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../../shared/capture";
import { getEnvOrFail } from "../../shared/env";
import { getSingleMessageOrFail } from "../../shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;
  const parsedBody = parseBody(message.body);
  const runJobHandler = new RunJobDirect();
  await runJobHandler.runJob(parsedBody);
});

export const runJobSchema = z.object({
  id: z.string(),
  cxId: z.string(),
  runUrl: z.string(),
});

function parseBody(body?: unknown): RunJobRequest {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return runJobSchema.parse(bodyAsJson);
}
