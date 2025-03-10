import { ProcessSyncPatientRequest } from "@metriport/core/command/ehr/sync-patient/ehr-sync-patient";
import { EhrSyncPatientLocal } from "@metriport/core/command/ehr/sync-patient/ehr-sync-patient-local";
import { EhrSource } from "@metriport/core/src/external/shared/ehr";
import { errorToString, MetriportError } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { parseEhrIds } from "./shared/ehr";
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
  let errorHandled = false;
  const errorMsg = "Error processing event on " + lambdaName;
  const startedAt = new Date().getTime();
  try {
    const message = getSingleMessageOrFail(event.Records, lambdaName);
    if (!message) return;

    console.log(`Running with unparsed body: ${message.body}`);
    const parsedBody = parseBody(message.body);
    const { ehr, cxId, practiceId, patientId, triggerDq } = parsedBody;

    const log = prefixedLog(
      `ehr ${ehr}, cxId ${cxId}, practiceId ${practiceId}, patientId ${patientId}`
    );
    try {
      log(`Parsed: ${JSON.stringify(parsedBody)}, waitTimeInMillis ${waitTimeInMillis}`);

      const processSyncPatientRequest: ProcessSyncPatientRequest = {
        ehr,
        cxId,
        practiceId,
        patientId,
        triggerDq,
      };
      const ehrSyncPatientHandler = new EhrSyncPatientLocal(waitTimeInMillis);

      await ehrSyncPatientHandler.processSyncPatient(processSyncPatientRequest);

      const finishedAt = new Date().getTime();
      log(`Done local duration: ${finishedAt - startedAt}ms`);
    } catch (error) {
      errorHandled = true;
      capture.error(errorMsg, {
        extra: { event, context: lambdaName, error },
      });
      throw new MetriportError(errorMsg, error, {
        ...{ ...parsedBody, patientPayload: undefined },
      });
    }
  } catch (error) {
    if (errorHandled) throw error;
    console.log(`${errorMsg}: ${errorToString(error)}`);
    capture.error(errorMsg, {
      extra: { event, context: lambdaName, error },
    });
    throw new MetriportError(errorMsg, error);
  }
}

function parseBody(body?: unknown): {
  cxId: string;
  ehr: EhrSource;
  practiceId: string;
  patientId: string;
  triggerDq: boolean;
} {
  if (!body) throw new Error(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const { cxIdRaw, ehrRaw, practiceIdRaw, patientIdRaw, triggerDqRaw } = parseEhrIds(bodyAsJson);

  const cxId = cxIdRaw;
  const ehr = ehrRaw;
  const practiceId = practiceIdRaw;
  const patientId = patientIdRaw;
  const triggerDq = triggerDqRaw;

  return {
    cxId,
    ehr,
    practiceId,
    patientId,
    triggerDq,
  };
}
