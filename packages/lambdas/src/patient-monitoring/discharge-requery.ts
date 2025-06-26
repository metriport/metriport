import { processDischargeRequeryRequestSchema } from "@metriport/core/command/patient-monitoring/discharge-requery/discharge-requery";
import { DischargeRequeryDirect } from "@metriport/core/command/patient-monitoring/discharge-requery/discharge-requery-direct";
import { SQSEvent } from "aws-lambda";
import { capture } from "../shared/capture";
import { getEnvOrFail } from "../shared/env";
import { prefixedLog } from "../shared/log";
import { getSingleMessageOrFail } from "../shared/sqs";
import { parseBody } from "../shared/parse-body";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const waitTimeInMillisRaw = getEnvOrFail("WAIT_TIME_IN_MILLIS");
const waitTimeInMillis = parseInt(waitTimeInMillisRaw);
const maxAttemptsRaw = getEnvOrFail("MAX_ATTEMPTS");
const maxAttempts = parseInt(maxAttemptsRaw);

export const handler = capture.wrapHandler(async (event: SQSEvent): Promise<void> => {
  capture.setExtra({ event, context: lambdaName });
  const startedAt = new Date().getTime();

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  console.log(`Running with unparsed body: ${message.body}`);
  const parsedBody = parseBody(processDischargeRequeryRequestSchema, message.body);
  capture.setExtra({ ...parsedBody });

  const { cxId, jobId, patientId } = parsedBody;
  const log = prefixedLog(`cxId ${cxId}, job ${jobId}, patientId ${patientId}`);
  log(`Parsed: ${JSON.stringify(parsedBody)}`);

  const receiveCount = parseInt(message.attributes.ApproximateReceiveCount);
  const reportError = receiveCount >= maxAttempts;
  log(`Receive count: ${receiveCount}, max attempts: ${maxAttempts}, reportError: ${reportError}`);

  const dischargeRequeryHandler = new DischargeRequeryDirect(waitTimeInMillis);
  await dischargeRequeryHandler.processDischargeRequery({ ...parsedBody, reportError });

  const finishedAt = new Date().getTime();
  console.log(`Done local duration: ${finishedAt - startedAt}ms`);
});
