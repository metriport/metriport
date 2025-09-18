import { PatientImportParseRequest } from "@metriport/core/command/patient-import/steps/parse/patient-import-parse";
import {
  processJobParse,
  ProcessJobParseCommandRequest,
} from "@metriport/core/command/patient-import/steps/parse/patient-import-parse-command";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const patientImportBucket = getEnvOrFail("PATIENT_IMPORT_BUCKET_NAME");

export const handler = capture.wrapHandler(
  async (params: PatientImportParseRequest): Promise<void> => {
    capture.setExtra({ ...params, context: lambdaName });
    const { cxId, jobId } = params;
    const { log } = out(`bulk import parse - cx ${cxId} job ${jobId}`);
    log(`Running the bulk import parse w/ params ${JSON.stringify(params)}`);

    const startedAt = new Date().getTime();
    try {
      const cmdParams: ProcessJobParseCommandRequest = {
        ...params,
        patientImportBucket,
      };
      await processJobParse(cmdParams);

      const finishedAt = new Date().getTime();
      log(`Done local duration: ${finishedAt - startedAt}ms`);
    } catch (error) {
      log(` Error processing event on ${lambdaName}: ${errorToString(error)}`);
      throw error;
    }
  }
);
