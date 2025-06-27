import { RunJobDirect } from "@metriport/core/command/job/patient/command/run-job/run-job-direct";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../../shared/capture";
import { getEnvOrFail } from "../../shared/env";
import { parseBody } from "../../shared/parse-body";
import { getSingleMessageOrFail } from "../../shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;
  const parsedBody = parseBody(runJobSchema, message.body);
  const runJobHandler = new RunJobDirect();
  await runJobHandler.runJob(parsedBody);
});

export const runJobSchema = z.object({
  id: z.string(),
  cxId: z.string(),
  runUrl: z.string(),
});
