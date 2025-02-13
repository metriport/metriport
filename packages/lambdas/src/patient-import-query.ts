import { ProcessPatientQueryRequest } from "@metriport/core/command/patient-import/steps/query/patient-import-query";
import { PatientImportQueryHandlerLocal } from "@metriport/core/command/patient-import/steps/query/patient-import-query-local";
import { errorToString, MetriportError } from "@metriport/shared";
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
    const {
      cxId,
      jobId,
      patientId,
      triggerConsolidated,
      disableWebhooks,
      rerunPdOnNewDemographics,
    } = parsedBody;

    const log = prefixedLog(`cxId ${cxId}, job ${jobId}, patientId ${patientId}`);
    try {
      log(
        `Parsed: ${JSON.stringify(
          parsedBody
        )}, patientImportBucket ${patientImportBucket}, waitTimeInMillis ${waitTimeInMillis}`
      );

      const processPatientQueryRequest: ProcessPatientQueryRequest = {
        cxId,
        jobId,
        patientId,
        triggerConsolidated,
        disableWebhooks,
        rerunPdOnNewDemographics,
      };
      const patientImportHandler = new PatientImportQueryHandlerLocal(
        patientImportBucket,
        waitTimeInMillis
      );

      await patientImportHandler.processPatientQuery(processPatientQueryRequest);

      const finishedAt = new Date().getTime();
      console.log(`Done local duration: ${finishedAt - startedAt}ms`);
    } catch (error) {
      errorHandled = true;
      console.log(`${errorMsg}: ${errorToString(error)}`);
      capture.error(errorMsg, {
        extra: { event, context: lambdaName, error },
      });
      throw new MetriportError(errorMsg, error, { ...parsedBody });
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

function parseBody(body?: unknown): ProcessPatientQueryRequest {
  if (!body) throw new Error(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const { cxIdRaw, jobIdRaw } = parseCxIdAndJob(bodyAsJson);
  const triggerConsolidatedRaw = parseTriggerConsolidatedOrFail(bodyAsJson);
  const disableWebhooksRaw = parseDisableWebhooksOrFail(bodyAsJson);
  const rerunPdOnNewDemographicsRaw = parseRerunPdOnNewDemos(bodyAsJson);

  const patientIdRaw = bodyAsJson.patientId;
  if (!patientIdRaw) throw new Error(`Missing patientId`);
  if (typeof patientIdRaw !== "string") throw new Error(`Invalid patientId`);

  const cxId = cxIdRaw;
  const jobId = jobIdRaw;
  const patientId = patientIdRaw;
  const triggerConsolidated = triggerConsolidatedRaw;
  const disableWebhooks = disableWebhooksRaw;
  const rerunPdOnNewDemographics = rerunPdOnNewDemographicsRaw;

  return {
    cxId,
    jobId,
    patientId,
    triggerConsolidated,
    disableWebhooks,
    rerunPdOnNewDemographics,
  };
}
