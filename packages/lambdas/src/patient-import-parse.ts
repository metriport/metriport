import { StartPatientImportRequest } from "@metriport/core/command/patient-import/steps/parse/patient-import-parse";
import { PatientImportParseLocal } from "@metriport/core/command/patient-import/steps/parse/patient-import-parse-local";
import { errorToString, MetriportError } from "@metriport/shared";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import {
  parseCxIdAndJob,
  parseDisableWebhooks,
  parseDryRun,
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
    const { cxId, jobId, triggerConsolidated, disableWebhooks, rerunPdOnNewDemographics, dryRun } =
      parsedBody;

    const log = prefixedLog(`cxId ${cxId}, job ${jobId}`);
    try {
      log(
        `Parsed: ${JSON.stringify(
          parsedBody
        )}, patientImportBucket ${patientImportBucket}, processPatientCreateQueue}`
      );

      const processJobParseRequest: StartPatientImportRequest = {
        cxId,
        jobId,
        triggerConsolidated,
        disableWebhooks,
        rerunPdOnNewDemographics,
        dryRun,
      };
      const patientImportParser = new PatientImportParseLocal(patientImportBucket);

      await patientImportParser.processJobParse(processJobParseRequest);

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
  const triggerConsolidatedRaw = parseTriggerConsolidated(bodyAsJson);
  const disableWebhooksRaw = parseDisableWebhooks(bodyAsJson);
  const rerunPdOnNewDemographicsRaw = parseRerunPdOnNewDemos(bodyAsJson);
  const dryRunRaw = parseDryRun(bodyAsJson);

  const cxId = cxIdRaw;
  const jobId = jobIdRaw;
  const triggerConsolidated = triggerConsolidatedRaw;
  const disableWebhooks = disableWebhooksRaw;
  const rerunPdOnNewDemographics = rerunPdOnNewDemographicsRaw;
  const dryRun = dryRunRaw;

  return {
    cxId,
    jobId,
    triggerConsolidated,
    disableWebhooks,
    rerunPdOnNewDemographics,
    dryRun,
  };
}
