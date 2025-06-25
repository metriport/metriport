import { errorToString } from "@metriport/shared";
import { out } from "../../../../util";
import { Config } from "../../../../util/config";
import { PatientImportParse, PatientImportParseRequest } from "./patient-import-parse";
import { processJobParse } from "./patient-import-parse-command";

export class PatientImportParseLocal implements PatientImportParse {
  constructor(private readonly patientImportBucket = Config.getPatientImportBucket()) {}

  async processJobParse({
    cxId,
    jobId,
    forceStatusUpdate,
  }: PatientImportParseRequest): Promise<void> {
    const { log } = out(`PatientImport processJobParse.local - cxId ${cxId} jobId ${jobId}`);
    try {
      await processJobParse({
        cxId,
        jobId,
        forceStatusUpdate,
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
