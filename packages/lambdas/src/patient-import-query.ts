import { ProcessPatientQueryRequest } from "@metriport/core/command/patient-import/steps/query/patient-import-query";
import { PatientImportQueryLocal } from "@metriport/core/command/patient-import/steps/query/patient-import-query-local";
import { errorToString } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import {
  parseCxIdAndJob,
  parseDisableWebhooksOrFail,
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
    const { cxId, jobId, rowNumber, patientId } = parsedBody;
    capture.setExtra({ ...parsedBody });

    const log = prefixedLog(
      `cxId ${cxId}, job ${jobId}, rowNumber ${rowNumber}, patientId ${patientId}`
    );
    log(
      `Parsed: ${JSON.stringify(
        parsedBody
      )}, patientImportBucket ${patientImportBucket}, waitTimeInMillis ${waitTimeInMillis}`
    );

    const patientImportHandler = new PatientImportQueryLocal(patientImportBucket, waitTimeInMillis);
    await patientImportHandler.processPatientQuery(parsedBody);

    const finishedAt = new Date().getTime();
    console.log(`Done local duration: ${finishedAt - startedAt}ms`);
  } catch (error) {
    console.log(`Error processing event on ${lambdaName}: ${errorToString(error)}`);
    throw error;
  }
});

function parseBody(body?: unknown): ProcessPatientQueryRequest {
  if (!body) throw new Error(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const { cxIdRaw, jobIdRaw } = parseCxIdAndJob(bodyAsJson);
  const triggerConsolidatedRaw = parseTriggerConsolidatedOrFail(bodyAsJson);
  const disableWebhooksRaw = parseDisableWebhooksOrFail(bodyAsJson);
  const rerunPdOnNewDemographicsRaw = parseRerunPdOnNewDemos(bodyAsJson);

  const rowNumberRaw = bodyAsJson.rowNumber;
  if (rowNumberRaw == undefined) throw new Error(`Missing rowNumber`);
  if (typeof rowNumberRaw !== "number") throw new Error(`Invalid rowNumber`);

  const patientIdRaw = bodyAsJson.patientId;
  if (!patientIdRaw) throw new Error(`Missing patientId`);
  if (typeof patientIdRaw !== "string") throw new Error(`Invalid patientId`);

  const dataPipelineRequestIdRaw = bodyAsJson.dataPipelineRequestId;
  if (!dataPipelineRequestIdRaw) throw new Error(`Missing dataPipelineRequestId`);
  if (typeof dataPipelineRequestIdRaw !== "string") {
    throw new Error(`Invalid dataPipelineRequestId`);
  }

  const cxId = cxIdRaw;
  const jobId = jobIdRaw;
  const rowNumber = rowNumberRaw;
  const patientId = patientIdRaw;
  const dataPipelineRequestId = dataPipelineRequestIdRaw;
  const triggerConsolidated = triggerConsolidatedRaw;
  const disableWebhooks = disableWebhooksRaw;
  const rerunPdOnNewDemographics = rerunPdOnNewDemographicsRaw;

  return {
    cxId,
    jobId,
    rowNumber,
    patientId,
    dataPipelineRequestId,
    triggerConsolidated,
    disableWebhooks,
    rerunPdOnNewDemographics,
  };
}
