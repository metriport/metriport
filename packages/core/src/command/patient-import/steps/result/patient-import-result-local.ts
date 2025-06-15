import { errorToString } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { PatientImportResult, ProcessPatientResult } from "./patient-import-result";
import { processPatientResult } from "./patient-import-result-command";

export class PatientImportResultLocal implements PatientImportResult {
  constructor(private readonly patientImportBucket = Config.getPatientImportBucket()) {}

  /**
   * Consolidates the individual patient records into a single file and updates the job status at
   * the API (which might do other things, like sending WH requests).
   */
  async processJobResult({ cxId, jobId }: ProcessPatientResult): Promise<void> {
    const { log } = out(`PatientImport processJobResult.local - cxId ${cxId} jobId ${jobId}`);
    try {
      await processPatientResult({
        cxId,
        jobId,
        patientImportBucket: this.patientImportBucket,
      });
    } catch (error) {
      const msg = `Failure while calling the command`;
      const errorMsg = errorToString(error);
      log(`${msg}. Cause: ${errorMsg}`);
      // intentionally swallowing the error here, we want to simulate the cloud behavior
      // where the command is called asynchronously and the error is not propagated upstream
    }
  }
}
