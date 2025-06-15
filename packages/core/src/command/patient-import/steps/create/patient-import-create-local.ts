import { errorToString } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { PatientImportCreate, ProcessPatientCreateRequest } from "./patient-import-create";
import { processPatientCreate } from "./patient-import-create-command";

export class PatientImportCreateLocal implements PatientImportCreate {
  constructor(
    private readonly patientImportBucket: string = Config.getPatientImportBucket(),
    private readonly waitTimeInMillis: number = 0
  ) {}

  async processPatientCreate({
    cxId,
    facilityId,
    jobId,
    rowNumber,
    rerunPdOnNewDemographics,
    triggerConsolidated,
    disableWebhooks,
  }: ProcessPatientCreateRequest): Promise<void> {
    const { log } = out(
      `PatientImport processPatientCreate.local - cxId ${cxId} jobId ${jobId} rowNumber ${rowNumber}`
    );
    try {
      await processPatientCreate({
        cxId,
        facilityId,
        jobId,
        rowNumber,
        rerunPdOnNewDemographics,
        triggerConsolidated,
        disableWebhooks,
        patientImportBucket: this.patientImportBucket,
        waitTimeInMillis: this.waitTimeInMillis,
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
