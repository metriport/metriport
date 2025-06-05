import { ProcessLinkPatientRequest } from "@metriport/core/external/ehr/healthie/command/link-patient/healthie-link-patient";
import { HealthieLinkPatientLocal } from "@metriport/core/external/ehr/healthie/command/link-patient/healthie-link-patient-local";
import { MetriportError } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import { capture } from "../../shared/capture";
import { parseLinkPatient } from "../../shared/ehr";
import { getEnvOrFail } from "../../shared/env";
import { prefixedLog } from "../../shared/log";
import { getSingleMessageOrFail } from "../../shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const waitTimeInMillisRaw = getEnvOrFail("WAIT_TIME_IN_MILLIS");
const waitTimeInMillis = parseInt(waitTimeInMillisRaw);

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  const startedAt = new Date().getTime();
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  console.log(`Running with unparsed body: ${message.body}`);
  const parsedBody = parseBody(message.body);
  const { cxId, practiceId, patientId } = parsedBody;

  const log = prefixedLog(`cxId ${cxId}, practiceId ${practiceId}, patientId ${patientId}`);
  log(`Parsed: ${JSON.stringify(parsedBody)}, waitTimeInMillis ${waitTimeInMillis}`);

  const healthieLinkPatientHandler = new HealthieLinkPatientLocal(waitTimeInMillis);
  await healthieLinkPatientHandler.processLinkPatient(parsedBody);

  const finishedAt = new Date().getTime();
  log(`Done local duration: ${finishedAt - startedAt}ms`);
});

function parseBody(body?: unknown): ProcessLinkPatientRequest {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return parseLinkPatient(bodyAsJson);
}
