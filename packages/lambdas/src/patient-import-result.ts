import { ProcessPatientResult } from "@metriport/core/command/patient-import/steps/result/patient-import-result";
import { PatientImportResultLocal } from "@metriport/core/command/patient-import/steps/result/patient-import-result-local";
import { out } from "@metriport/core/util/log";
import { errorToString, MetriportError } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const patientImportBucket = getEnvOrFail("PATIENT_IMPORT_BUCKET_NAME");

export const handler = Sentry.AWSLambda.wrapHandler(
  async (params: ProcessPatientResult): Promise<void> => {
    const { cxId, jobId } = params;
    const { log } = out(`bulk import result - cx ${cxId} job ${jobId}`);
    log(`Running the bulk import result`);

    const startedAt = new Date().getTime();
    try {
      const patientImportResult = new PatientImportResultLocal(patientImportBucket);
      await patientImportResult.processJobResult(params);

      const finishedAt = new Date().getTime();
      log(`Done local duration: ${finishedAt - startedAt}ms`);
    } catch (error) {
      const errorMsg = "Error processing event on " + lambdaName;
      log(`${errorMsg}: ${errorToString(error)}`);
      Sentry.setExtras({ ...params, context: lambdaName, error });
      throw new MetriportError(errorMsg, error, { ...params });
    }
  }
);
