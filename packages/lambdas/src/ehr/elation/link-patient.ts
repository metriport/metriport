import { ProcessLinkPatientRequest } from "@metriport/core/external/ehr/elation/command/link-patient/elation-link-patient";
import { ElationLinkPatientLocal } from "@metriport/core/external/ehr/elation/command/link-patient/elation-link-patient-local";
import { getEnvAsIntOrFail, MetriportError } from "@metriport/shared";
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
const waitTimeInMillis = getEnvAsIntOrFail("WAIT_TIME_IN_MILLIS");

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const parsedBody = parseBody(message.body);
  const { cxId, practiceId, patientId } = parsedBody;

  const log = prefixedLog(`cxId ${cxId}, practiceId ${practiceId}, patientId ${patientId}`);
  log(`Parsed: ${JSON.stringify(parsedBody)}, waitTimeInMillis ${waitTimeInMillis}`);

  const elationLinkPatientHandler = new ElationLinkPatientLocal(waitTimeInMillis);
  await elationLinkPatientHandler.processLinkPatient(parsedBody);
});

function parseBody(body?: unknown): ProcessLinkPatientRequest {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return parseLinkPatient(bodyAsJson);
}
