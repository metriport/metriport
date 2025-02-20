import {
  PatientPayload,
  ProcessPatientCreateRequest,
} from "@metriport/core/command/patient-import/steps/create/patient-import-create";
import { PatientImportCreateHandlerLocal } from "@metriport/core/command/patient-import/steps/create/patient-import-create-local";
import { errorToString, MetriportError } from "@metriport/shared";
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
      facilityId,
      jobId,
      patientPayload,
      triggerConsolidated,
      disableWebhooks,
      rerunPdOnNewDemographics,
    } = parsedBody;

    const log = prefixedLog(`cxId ${cxId}, job ${jobId}`);
    try {
      log(
        `Parsed: ${JSON.stringify(
          parsedBody
        )}, patientImportBucket ${patientImportBucket}, waitTimeInMillis ${waitTimeInMillis}`
      );

      const processPatientCreateRequest: ProcessPatientCreateRequest = {
        cxId,
        facilityId,
        jobId,
        patientPayload,
        triggerConsolidated,
        disableWebhooks,
        rerunPdOnNewDemographics,
      };
      const patientImportHandler = new PatientImportCreateHandlerLocal(
        patientImportBucket,
        waitTimeInMillis
      );

      await patientImportHandler.processPatientCreate(processPatientCreateRequest);

      const finishedAt = new Date().getTime();
      log(`Done local duration: ${finishedAt - startedAt}ms`);
    } catch (error) {
      errorHandled = true;
      log(`${errorMsg}: ${errorToString(error)}`);
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

function parseBody(body?: unknown): ProcessPatientCreateRequest {
  if (!body) throw new Error(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const { cxIdRaw, jobIdRaw } = parseCxIdAndJob(bodyAsJson);
  const { facilityIdRaw } = parseFacilityId(bodyAsJson);
  const triggerConsolidatedRaw = parseTriggerConsolidatedOrFail(bodyAsJson);
  const disableWebhooksRaw = parseDisableWebhooksOrFail(bodyAsJson);
  const rerunPdOnNewDemographicsRaw = parseRerunPdOnNewDemos(bodyAsJson);

  const patientPayloadRaw = bodyAsJson.patientPayload;
  if (!patientPayloadRaw) throw new Error(`Missing patientPayload`);
  if (typeof patientPayloadRaw !== "object") throw new Error(`Invalid patientPayload`);

  const cxId = cxIdRaw;
  const facilityId = facilityIdRaw;
  const jobId = jobIdRaw;
  const patientPayload = patientPayloadRaw as PatientPayload;
  const triggerConsolidated = triggerConsolidatedRaw;
  const disableWebhooks = disableWebhooksRaw;
  const rerunPdOnNewDemographics = rerunPdOnNewDemographicsRaw;

  return {
    cxId,
    facilityId,
    jobId,
    patientPayload,
    triggerConsolidated,
    disableWebhooks,
    rerunPdOnNewDemographics,
  };
}
