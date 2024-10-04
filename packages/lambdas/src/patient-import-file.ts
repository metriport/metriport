import { errorToString, MetriportError } from "@metriport/shared";
import { makePatientImportHandler } from "@metriport/core/command/patient-import/patient-import-factory";
import { ProcessPatientImportEvemtPayload } from "@metriport/core/command/patient-import/patient-import-cloud";
import { ProcessPatientImportRequest } from "@metriport/core/command/patient-import/patient-import";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const patientImportBucket = getEnvOrFail("PATIENT_IMPORT_BUCKET_NAME");
const processPatientCreateQueue = getEnvOrFail("PATIENT_CREATE_QUEUE_URL");

// Don't use Sentry's default error handler b/c we want to use our own and send more context-aware data
export async function handler(event: ProcessPatientImportEvemtPayload) {
  let errorHandled = false;
  const errorMsg = "Error processing event on " + lambdaName;
  const startedAt = new Date().getTime();
  try {
    console.log(`Running with unparsed body: ${JSON.stringify(event)}`);
    const parsedBody = parseBody(event);
    const { cxId, facilityId, jobId, rerunPdOnNewDemographics, dryrun } = parsedBody;

    const jobStartedAt = new Date().toISOString();

    const log = prefixedLog(`cxId ${cxId}, job ${jobId}`);
    try {
      log(
        `Parsed: ${JSON.stringify(
          parsedBody
        )}, jobStartedAt ${jobStartedAt}, patientImportBucket ${patientImportBucket}, processPatientCreateQueue ${processPatientCreateQueue}`
      );

      const processPatientImportRequest: ProcessPatientImportRequest = {
        cxId,
        facilityId,
        jobId,
        jobStartedAt,
        s3BucketName: patientImportBucket,
        processPatientCreateQueue,
        rerunPdOnNewDemographics,
        dryrun,
      };

      const patientImportHandler = makePatientImportHandler();
      patientImportHandler.processPatientImport(processPatientImportRequest);

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

function parseBody(body?: unknown): ProcessPatientImportEvemtPayload {
  if (!body) throw new Error(`Missing message body`);

  const bodyAsJson = typeof body === "string" ? JSON.parse(body) : body;

  const cxIdRaw = bodyAsJson.cxId;
  if (!cxIdRaw) throw new Error(`Missing cxId`);
  if (typeof cxIdRaw !== "string") throw new Error(`Invalid cxId`);

  const facilityIdRaw = bodyAsJson.facilityId;
  if (!facilityIdRaw) throw new Error(`Missing cxId`);
  if (typeof facilityIdRaw !== "string") throw new Error(`Invalid facilityId`);

  const jobIdRaw = bodyAsJson.jobId;
  if (!jobIdRaw) throw new Error(`Missing jobId`);
  if (typeof jobIdRaw !== "string") throw new Error(`Invalid jobId`);

  const rerunPdOnNewDemographicsRaw = bodyAsJson.rerunPdOnNewDemographics;
  if (rerunPdOnNewDemographicsRaw === undefined)
    throw new Error(`Missing rerunPdOnNewDemographics`);
  if (typeof rerunPdOnNewDemographicsRaw !== "boolean")
    throw new Error(`Invalid rerunPdOnNewDemographics`);

  const dryrunRaw = bodyAsJson.dryrun;
  if (dryrunRaw === undefined) throw new Error(`Missing dryrun`);
  if (typeof dryrunRaw !== "boolean") throw new Error(`Invalid dryrun`);

  const cxId = cxIdRaw as string;
  const facilityId = facilityIdRaw as string;
  const jobId = jobIdRaw as string;
  const rerunPdOnNewDemographics = rerunPdOnNewDemographicsRaw as boolean;
  const dryrun = dryrunRaw as boolean;

  return { cxId, facilityId, jobId, rerunPdOnNewDemographics, dryrun };
}
