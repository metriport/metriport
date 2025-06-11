import { ProcessPatientResult } from "@metriport/core/command/patient-import/steps/result/patient-import-result";
import { PatientImportResultLocal } from "@metriport/core/command/patient-import/steps/result/patient-import-result-local";
import { errorToString } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const patientImportBucket = getEnvOrFail("PATIENT_IMPORT_BUCKET_NAME");

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ cxId, jobId }: ProcessPatientResult): Promise<void> => {
    capture.setExtra({ cxId, jobId, context: lambdaName });
    const log = prefixedLog(`cx ${cxId} job ${jobId}`);
    log(`Running the bulk import result`);

    const startedAt = new Date().getTime();
    try {
      const patientImportResult = new PatientImportResultLocal(patientImportBucket);
      await patientImportResult.processJobResult({ cxId, jobId });

      const finishedAt = new Date().getTime();
      log(`Done local duration: ${finishedAt - startedAt}ms`);
    } catch (error) {
      log(`Error processing event on ${lambdaName}: ${errorToString(error)}`);
      throw error;
    }
  }
);
