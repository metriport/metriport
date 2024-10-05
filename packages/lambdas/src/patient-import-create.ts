import { SQSEvent } from "aws-lambda";
import { errorToString, MetriportError } from "@metriport/shared";
import { makePatientImportHandler } from "@metriport/core/command/patient-import/patient-import-factory";
import { ProcessPatientCreateEvemtPayload } from "@metriport/core/command/patient-import/patient-import-cloud";
import {
  ProcessPatientCreateRequest,
  PatientPayload,
} from "@metriport/core/command/patient-import/patient-import";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { getSingleMessageOrFail } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const patientImportBucket = getEnvOrFail("PATIENT_IMPORT_BUCKET_NAME");
const processPatientQueryQueue = getEnvOrFail("PATIENT_QUERY_QUEUE_URL");
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
    const { cxId, facilityId, jobId, jobStartedAt, patientPayload, rerunPdOnNewDemographics } =
      parsedBody;

    const log = prefixedLog(`cxId ${cxId}, job ${jobId}`);
    try {
      log(
        `Parsed: ${JSON.stringify(
          parsedBody
        )}, patientImportBucket ${patientImportBucket}, processPatientQueryQueue ${processPatientQueryQueue}, waitTimeInMillis ${waitTimeInMillis}`
      );

      const processPatientCreateRequest: ProcessPatientCreateRequest = {
        cxId,
        facilityId,
        jobId,
        jobStartedAt,
        s3BucketName: patientImportBucket,
        patientPayload,
        processPatientQueryQueue,
        rerunPdOnNewDemographics,
        waitTimeInMillis,
      };

      const patientImportHandler = makePatientImportHandler();
      await patientImportHandler.processPatientCreate(processPatientCreateRequest);

      const finishedAt = new Date().getTime();
      console.log(`Done local duration: ${finishedAt - startedAt}ms`);
    } catch (error) {
      errorHandled = true;
      console.log(`${errorMsg}: ${errorToString(error)}`);
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

function parseBody(body?: unknown): ProcessPatientCreateEvemtPayload {
  if (!body) throw new Error(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const cxIdRaw = bodyAsJson.cxId;
  if (!cxIdRaw) throw new Error(`Missing cxId`);
  if (typeof cxIdRaw !== "string") throw new Error(`Invalid cxId`);

  const facilityIdRaw = bodyAsJson.facilityId;
  if (!facilityIdRaw) throw new Error(`Missing cxId`);
  if (typeof facilityIdRaw !== "string") throw new Error(`Invalid facilityId`);

  const jobIdRaw = bodyAsJson.jobId;
  if (!jobIdRaw) throw new Error(`Missing jobId`);
  if (typeof jobIdRaw !== "string") throw new Error(`Invalid jobId`);

  const jobStartedAtRaw = bodyAsJson.jobStartedAt;
  if (!jobStartedAtRaw) throw new Error(`Missing jobStartedAt`);
  if (typeof jobStartedAtRaw !== "string") throw new Error(`Invalid jobStartedAt`);

  const patientPayloadRaw = bodyAsJson.patientPayload;
  if (!patientPayloadRaw) throw new Error(`Missing patientPayload`);
  if (typeof patientPayloadRaw !== "object") throw new Error(`Invalid patientPayload`);

  const rerunPdOnNewDemographicsRaw = bodyAsJson.rerunPdOnNewDemographics;
  if (rerunPdOnNewDemographicsRaw === undefined)
    throw new Error(`Missing rerunPdOnNewDemographics`);
  if (typeof rerunPdOnNewDemographicsRaw !== "boolean")
    throw new Error(`Invalid rerunPdOnNewDemographics`);

  const cxId = cxIdRaw as string;
  const facilityId = facilityIdRaw as string;
  const jobId = jobIdRaw as string;
  const jobStartedAt = jobStartedAtRaw as string;
  const patientPayload = patientPayloadRaw as PatientPayload;
  const rerunPdOnNewDemographics = rerunPdOnNewDemographicsRaw as boolean;

  return { cxId, facilityId, jobId, jobStartedAt, patientPayload, rerunPdOnNewDemographics };
}
