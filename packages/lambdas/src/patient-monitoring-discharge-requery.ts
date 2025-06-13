import { processDischargeRequeryRequestSchema } from "@metriport/core/command/patient-monitoring/discharge-requery/discharge-requery";
import { DischargeRequeryLocal } from "@metriport/core/command/patient-monitoring/discharge-requery/discharge-requery-local";
import { errorToString } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { getSingleMessageOrFail } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(async function handler(event: SQSEvent) {
  capture.setExtra({ event, context: lambdaName });
  const startedAt = new Date().getTime();
  try {
    const message = getSingleMessageOrFail(event.Records, lambdaName);
    if (!message) return;

    console.log(`Running with unparsed body: ${message.body}`);
    const parsedBody = processDischargeRequeryRequestSchema.parse(message.body);
    const { cxId, jobId, patientId } = parsedBody;
    capture.setExtra({ ...parsedBody });

    const log = prefixedLog(`cxId ${cxId}, job ${jobId}, patientId ${patientId}`);
    log(`Parsed: ${JSON.stringify(parsedBody)}`);

    const dischargeRequeryHandler = new DischargeRequeryLocal();
    await dischargeRequeryHandler.processDischargeRequery(parsedBody);

    const finishedAt = new Date().getTime();
    console.log(`Done local duration: ${finishedAt - startedAt}ms`);
  } catch (error) {
    console.log(`Error processing event on ${lambdaName}: ${errorToString(error)}`);
    throw error;
  }
});
