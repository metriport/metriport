import { errorToString, sleep } from "@metriport/shared";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { createPatient } from "../../api/create-patient";
import { checkPatientRecordExists } from "../../record/check-patient-record-exists";
import { creatOrUpdatePatientRecord } from "../../record/create-or-update-patient-record";
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
        patientId,
        data: { status: "processing" },
        s3BucketName: this.patientImportBucket,
      });
      const processPatientQueryRequest: ProcessPatientQueryRequest = {
        cxId,
        jobId,
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
