import { StartPatientImportRequest } from "@metriport/core/command/patient-import/steps/parse/patient-import-parse";
import { PatientImportParseLocal } from "@metriport/core/command/patient-import/steps/parse/patient-import-parse-local";
import { errorToString, MetriportError } from "@metriport/shared";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import {
  parseCxIdAndJob,
  parseDisableWebhooks,
  parseFacilityId,
  parseRerunPdOnNewDemos,
  parseTriggerConsolidated,
} from "./shared/patient-import";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const patientImportBucket = getEnvOrFail("PATIENT_IMPORT_BUCKET_NAME");

// Don't use Sentry's default error handler b/c we want to use our own and send more context-aware data
export async function handler(event: StartPatientImportRequest) {
  let errorHandled = false;
  const errorMsg = "Error processing event on " + lambdaName;
  const startedAt = new Date().getTime();
  try {
    console.log(`Running with unparsed body: ${JSON.stringify(event)}`);
    const parsedBody = parseBody(event);
    const {
      cxId,
      facilityId,
      jobId,
      triggerConsolidated,
      disableWebhooks,
      rerunPdOnNewDemographics,
      dryRun,
    } = parsedBody;

    const log = prefixedLog(`cxId ${cxId}, job ${jobId}`);
    try {
      log(
        `Parsed: ${JSON.stringify(
          parsedBody
        )}, patientImportBucket ${patientImportBucket}, processPatientCreateQueue}`
      );

      const processPatientImportRequest: StartPatientImportRequest = {
        cxId,
        facilityId,
        jobId,
        triggerConsolidated,
        disableWebhooks,
        rerunPdOnNewDemographics,
        dryRun,
      };
      const patientImportHandler = new PatientImportParseLocal(patientImportBucket);

      await patientImportHandler.startPatientImport(processPatientImportRequest);

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

function parseBody(body?: unknown): StartPatientImportRequest {
  if (!body) throw new Error(`Missing message body`);

  const bodyAsJson = typeof body === "string" ? JSON.parse(body) : body;

  const { cxIdRaw, jobIdRaw } = parseCxIdAndJob(bodyAsJson);
  const { facilityIdRaw } = parseFacilityId(bodyAsJson);
  const { triggerConsolidatedRaw } = parseTriggerConsolidated(bodyAsJson);
  const { disableWebhooksRaw } = parseDisableWebhooks(bodyAsJson);
  const { rerunPdOnNewDemographicsRaw } = parseRerunPdOnNewDemos(bodyAsJson);

  const dryRunRaw = bodyAsJson.dryRun;
  if (dryRunRaw === undefined) throw new Error(`Missing dryRun`);
  if (typeof dryRunRaw !== "boolean") throw new Error(`Invalid dryRun`);

  const cxId = cxIdRaw;
  const facilityId = facilityIdRaw;
  const jobId = jobIdRaw;
  const triggerConsolidated = triggerConsolidatedRaw;
  const disableWebhooks = disableWebhooksRaw;
  const rerunPdOnNewDemographics = rerunPdOnNewDemographicsRaw;
  const dryRun = dryRunRaw;

  return {
    cxId,
    facilityId,
    jobId,
    triggerConsolidated,
    disableWebhooks,
    rerunPdOnNewDemographics,
    dryRun,
  };
}
