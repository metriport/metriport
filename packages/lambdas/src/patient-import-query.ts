import { SQSEvent } from "aws-lambda";
import { errorToString, MetriportError } from "@metriport/shared";
import { makePatientImportHandler } from "@metriport/core/command/patient-import/patient-import-factory";
import { ProcessPatientQueryEvemtPayload } from "@metriport/core/command/patient-import/patient-import-cloud";
import { ProcessPatientQueryRequest } from "@metriport/core/command/patient-import/patient-import";
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
    const { cxId, jobId, patientId, rerunPdOnNewDemographics } = parsedBody;

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
        s3BucketName: patientImportBucket,
        rerunPdOnNewDemographics,
        waitTimeInMillis,
      };

      const patientImportHandler = makePatientImportHandler();
      patientImportHandler.processPatientQuery(processPatientQueryRequest);

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

function parseBody(body?: unknown): ProcessPatientQueryEvemtPayload {
  if (!body) throw new Error(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const cxIdRaw = bodyAsJson.cxId;
  if (!cxIdRaw) throw new Error(`Missing cxId`);
  if (typeof cxIdRaw !== "string") throw new Error(`Invalid cxId`);

  const jobIdRaw = bodyAsJson.jobId;
  if (!jobIdRaw) throw new Error(`Missing jobId`);
  if (typeof jobIdRaw !== "string") throw new Error(`Invalid jobId`);

  const patientIdRaw = bodyAsJson.patientId;
  if (!patientIdRaw) throw new Error(`Missing patientId`);
  if (typeof patientIdRaw !== "string") throw new Error(`Invalid patientId`);

  const rerunPdOnNewDemographicsRaw = bodyAsJson.rerunPdOnNewDemographics;
  if (!rerunPdOnNewDemographicsRaw) throw new Error(`Missing rerunPdOnNewDemographics`);
  if (typeof rerunPdOnNewDemographicsRaw !== "boolean")
    throw new Error(`Invalid rerunPdOnNewDemographics`);

  const cxId = cxIdRaw as string;
  const jobId = jobIdRaw as string;
  const patientId = patientIdRaw as string;
  const rerunPdOnNewDemographics = rerunPdOnNewDemographicsRaw as boolean;

  return { cxId, jobId, patientId, rerunPdOnNewDemographics };
}