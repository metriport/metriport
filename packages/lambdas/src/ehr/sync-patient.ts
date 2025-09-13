import { EhrSyncPatientDirect } from "@metriport/core/external/ehr/command/sync-patient/ehr-sync-patient-direct";
import { getEnvAsIntOrFail } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { capture } from "../shared/capture";
import { ehrSyncPatientSchema } from "../shared/ehr";
import { getEnvOrFail } from "../shared/env";
import { prefixedLog } from "../shared/log";
import { parseBody } from "../shared/parse-body";
import { getSingleMessageOrFail } from "../shared/sqs";

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

  const parsedBody = parseBody(ehrSyncPatientSchema, message.body);
  const { ehr, cxId, practiceId, patientId } = parsedBody;

  const log = prefixedLog(
    `ehr ${ehr}, cxId ${cxId}, practiceId ${practiceId}, patientId ${patientId}`
  );
  log(`Parsed: ${JSON.stringify(parsedBody)}, waitTimeInMillis ${waitTimeInMillis}`);

  const ehrSyncPatientHandler = new EhrSyncPatientDirect(waitTimeInMillis);
  await ehrSyncPatientHandler.processSyncPatient(parsedBody);
});
