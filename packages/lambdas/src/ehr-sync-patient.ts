import { ProcessSyncPatientRequest } from "@metriport/core/external/ehr/sync-patient/ehr-sync-patient";
import { EhrSyncPatientLocal } from "@metriport/core/external/ehr/sync-patient/ehr-sync-patient-local";
import { errorToString, MetriportError } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { parseSyncPatient } from "./shared/ehr";
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

// Don't use Sentry's default error handler b/c we want to use our own and send more context-aware data
export async function handler(event: SQSEvent) {
  try {
    const startedAt = new Date().getTime();
    const message = getSingleMessageOrFail(event.Records, lambdaName);
    if (!message) return;

    console.log(`Running with unparsed body: ${message.body}`);
    const parsedBody = parseBody(message.body);
    const { ehr, cxId, practiceId, patientId } = parsedBody;

    const log = prefixedLog(
      `ehr ${ehr}, cxId ${cxId}, practiceId ${practiceId}, patientId ${patientId}`
    );
    log(`Parsed: ${JSON.stringify(parsedBody)}, waitTimeInMillis ${waitTimeInMillis}`);

    const ehrSyncPatientHandler = new EhrSyncPatientLocal(waitTimeInMillis);
    await ehrSyncPatientHandler.processSyncPatient(parsedBody);

    const finishedAt = new Date().getTime();
    log(`Done local duration: ${finishedAt - startedAt}ms`);
  } catch (error) {
    const msg = "Error processing event on " + lambdaName;
    console.log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, { extra: { event, context: lambdaName, error } });
    throw new MetriportError(msg, error);
  }
}

function parseBody(body?: unknown): ProcessSyncPatientRequest {
  if (!body) throw new Error(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return parseSyncPatient(bodyAsJson);
}
