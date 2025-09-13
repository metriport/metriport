import { errorToString } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { PatientImportQuery, ProcessPatientQueryRequest } from "./patient-import-query";
import { processPatientQuery } from "./patient-import-query-command";

export class PatientImportQueryLocal implements PatientImportQuery {
  constructor(
    private readonly patientImportBucket = Config.getPatientImportBucket(),
    private readonly waitTimeAtTheEndInMillis = 0
  ) {}

  async processPatientQuery({
    cxId,
    jobId,
    rowNumber,
    patientId,
    dataPipelineRequestId,
    triggerConsolidated,
    disableWebhooks,
    rerunPdOnNewDemographics,
  }: ProcessPatientQueryRequest) {
    const { log } = out(
      `PatientImport processPatientQuery.local - cxId ${cxId} jobId ${jobId} rowNumber ${rowNumber} patientId ${patientId}`
    );
    try {
      await processPatientQuery({
        cxId,
        jobId,
        rowNumber,
        patientId,
        dataPipelineRequestId,
        triggerConsolidated,
        disableWebhooks,
        rerunPdOnNewDemographics,
        patientImportBucket: this.patientImportBucket,
        waitTimeAtTheEndInMillis: this.waitTimeAtTheEndInMillis,
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
