import { ProcessPatientCreateRequest } from "@metriport/core/command/patient-import/steps/create/patient-import-create";
import { PatientImportCreateLocal } from "@metriport/core/command/patient-import/steps/create/patient-import-create-local";
import { errorToString } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import {
  parseCxIdAndJob,
  parseDisableWebhooksOrFail,
  parseFacilityId,
  parseRerunPdOnNewDemos,
  parseTriggerConsolidatedOrFail,
} from "./shared/patient-import";
import { getSingleMessageOrFail } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const patientImportBucket = getEnvOrFail("PATIENT_IMPORT_BUCKET_NAME");
const waitTimeInMillisRaw = getEnvOrFail("WAIT_TIME_IN_MILLIS");
const waitTimeInMillis = parseInt(waitTimeInMillisRaw);

export const handler = Sentry.AWSLambda.wrapHandler(async function handler(event: SQSEvent) {
  capture.setExtra({ event, context: lambdaName });
  const startedAt = new Date().getTime();
  try {
    const message = getSingleMessageOrFail(event.Records, lambdaName);
    if (!message) return;

    console.log(`Running with unparsed body: ${message.body}`);
    const parsedBody = parseBody(message.body);
    capture.setExtra({ ...parsedBody });
    const {
      cxId,
      facilityId,
      jobId,
      rowNumber,
      triggerConsolidated,
      disableWebhooks,
      rerunPdOnNewDemographics,
    } = parsedBody;

    const log = prefixedLog(`cxId ${cxId}, job ${jobId}`);
    log(
      `Parsed: ${JSON.stringify(
        parsedBody
      )}, patientImportBucket ${patientImportBucket}, waitTimeInMillis ${waitTimeInMillis}`
    );

    const processPatientCreateRequest: ProcessPatientCreateRequest = {
      cxId,
      facilityId,
      jobId,
      rowNumber,
      triggerConsolidated,
      disableWebhooks,
      rerunPdOnNewDemographics,
    };
    const patientImportHandler = new PatientImportCreateLocal(
      patientImportBucket,
      waitTimeInMillis
    );

    await patientImportHandler.processPatientCreate(processPatientCreateRequest);

    const finishedAt = new Date().getTime();
    log(`Done local duration: ${finishedAt - startedAt}ms`);
  } catch (error) {
    console.log(`Error processing event on ${lambdaName}: ${errorToString(error)}`);
    throw error;
  }
});

function parseBody(body?: unknown): Omit<ProcessPatientCreateRequest, "rowCsv" | "patientCreate"> {
  if (!body) throw new Error(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const { cxIdRaw, jobIdRaw } = parseCxIdAndJob(bodyAsJson);
  const { facilityIdRaw } = parseFacilityId(bodyAsJson);
  const triggerConsolidatedRaw = parseTriggerConsolidatedOrFail(bodyAsJson);
  const disableWebhooksRaw = parseDisableWebhooksOrFail(bodyAsJson);
  const rerunPdOnNewDemographicsRaw = parseRerunPdOnNewDemos(bodyAsJson);

  const rowNumberRaw = bodyAsJson.rowNumber;
  if (!rowNumberRaw) throw new Error(`Missing rowNumber`);
  if (typeof rowNumberRaw !== "number") throw new Error(`Invalid rowNumber`);

  const cxId = cxIdRaw;
  const facilityId = facilityIdRaw;
  const jobId = jobIdRaw;
  const rowNumber = rowNumberRaw;

  const triggerConsolidated = triggerConsolidatedRaw;
  const disableWebhooks = disableWebhooksRaw;
  const rerunPdOnNewDemographics = rerunPdOnNewDemographicsRaw;

  return {
    cxId,
    facilityId,
    jobId,
    rowNumber,
    triggerConsolidated,
    disableWebhooks,
    rerunPdOnNewDemographics,
  };
}
