import { errorToString, sleep } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { checkPatientRecordExists } from "../commands/check-patient-record-exists";
import { creatOrUpdatePatientRecord } from "../commands/create-or-update-patient-record";
import { createPatient } from "../commands/create-patient";
import { ProcessPatientQueryRequest } from "../query/patient-import-query";
import { buildPatientImportQueryHandler } from "../query/patient-import-query-factory";
import { PatientImportCreateHandler, ProcessPatientCreateRequest } from "./patient-import-create";

export class PatientImportCreateHandlerLocal implements PatientImportCreateHandler {
  constructor(
    private readonly patientImportBucket: string,
    private readonly waitTimeInMillis: number,
    private readonly next = buildPatientImportQueryHandler()
  ) {}

  async processPatientCreate({
    cxId,
    facilityId,
    jobId,
    jobStartedAt,
    patientPayload,
    triggerConsolidated,
    disableWebhooks,
    rerunPdOnNewDemographics,
  }: ProcessPatientCreateRequest): Promise<void> {
    const { log } = out(`processPatientCreate.local - cxId ${cxId} jobId ${jobId}`);
    try {
      const patientId = await createPatient({
        cxId,
        facilityId,
        patientPayload,
      });
      const recordExists = await checkPatientRecordExists({
        cxId,
        jobId,
        jobStartedAt,
        patientId,
        s3BucketName: this.patientImportBucket,
      });
      if (recordExists) {
        log(`Record exists for patientId ${patientId}, returning...`);
        return;
      }
      await creatOrUpdatePatientRecord({
        cxId,
        jobId,
        jobStartedAt,
        patientId,
        s3BucketName: this.patientImportBucket,
      });
      const processPatientQueryRequest: ProcessPatientQueryRequest = {
        cxId,
        jobId,
        jobStartedAt,
        patientId,
        triggerConsolidated,
        disableWebhooks,
        rerunPdOnNewDemographics,
      };
      await this.next.processPatientQuery(processPatientQueryRequest);

      if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
    } catch (error) {
      const msg = `Failure while processing patient create @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-create-local.processPatientCreate",
          error,
        },
      });
      throw error;
    }
  }
}
