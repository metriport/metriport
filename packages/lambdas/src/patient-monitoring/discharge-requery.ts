import { processDischargeRequeryRequestSchema } from "@metriport/core/command/patient-monitoring/discharge-requery/discharge-requery";
import { DischargeRequeryLocal } from "@metriport/core/command/patient-monitoring/discharge-requery/discharge-requery-local";
import { SQSEvent } from "aws-lambda";
import { capture } from "../shared/capture";
import { getEnvOrFail } from "../shared/env";
import { prefixedLog } from "../shared/log";
import { getSingleMessageOrFail } from "../shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async (event: SQSEvent): Promise<void> => {
  capture.setExtra({ event, context: lambdaName });
  const startedAt = new Date().getTime();

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  console.log(`Running with unparsed body: ${message.body}`);
  const parsedBody = processDischargeRequeryRequestSchema.parse(JSON.parse(message.body));
  const { cxId, jobId, patientId } = parsedBody;
  capture.setExtra({ ...parsedBody });

  const log = prefixedLog(`cxId ${cxId}, job ${jobId}, patientId ${patientId}`);
  log(`Parsed: ${JSON.stringify(parsedBody)}`);

  const dischargeRequeryHandler = new DischargeRequeryLocal();
  await dischargeRequeryHandler.processDischargeRequery(parsedBody);

  const finishedAt = new Date().getTime();
  console.log(`Done local duration: ${finishedAt - startedAt}ms`);
});
