import { errorToString, MetriportError, sleep } from "@metriport/shared";
import { out } from "../../../../util/log";
import { uuidv7 } from "../../../../util/uuid-v7";
import { createPatient } from "../../api/create-patient";
import { createPatientMapping } from "../../api/create-patient-mapping";
import { updatePatientRecord } from "../../record/create-or-update-patient-record";
import { ProcessPatientQueryRequest } from "../query/patient-import-query";
import { buildPatientImportQueryHandler } from "../query/patient-import-query-factory";
import { PatientImportCreate, ProcessPatientCreateRequest } from "./patient-import-create";

export class PatientImportCreateLocal implements PatientImportCreate {
  constructor(
    private readonly patientImportBucket: string,
    private readonly waitTimeInMillis: number,
    private readonly next = buildPatientImportQueryHandler()
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
    const { log } = out(`PatientImport processPatientCreate.local - cxId ${cxId} jobId ${jobId}`);
    try {
      const patientRecord = await updatePatientRecord({
        cxId,
        jobId,
        rowNumber,
        status: "processing",
        bucketName: this.patientImportBucket,
      });
      if (!patientRecord.patientCreate) {
        throw new MetriportError("Programming error, patientCreate is undefined", undefined, {
          cxId,
          jobId,
          rowNumber,
          status: patientRecord.status,
        });
      }

      const dataPipelineRequestId = uuidv7();

      const patientId = await createPatient({
        cxId,
        facilityId,
        patientPayload: patientRecord.patientCreate,
      });

      await Promise.all([
        updatePatientRecord({
          ...patientRecord,
          patientId,
          bucketName: this.patientImportBucket,
        }),
        createPatientMapping({
          cxId,
          jobId,
          rowNumber,
          patientId,
          dataPipelineRequestId,
        }),
      ]);

      const processPatientQueryRequest: ProcessPatientQueryRequest = {
        cxId,
        jobId,
        rowNumber,
        patientId,
        dataPipelineRequestId,
        rerunPdOnNewDemographics,
        triggerConsolidated,
        disableWebhooks,
      };
      await this.next.processPatientQuery(processPatientQueryRequest);

      if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
    } catch (error) {
      const msg = `Failure while processing patient create @ PatientImport`;
      const errorMsg = errorToString(error);
      log(`${msg}. Cause: ${errorMsg}`);
      let errorToUpdateRecordToFailed: string | undefined = undefined;
      try {
        await updatePatientRecord({
          cxId,
          jobId,
          rowNumber,
          status: "failed",
          reasonForCx: "Internal error",
          reasonForDev: errorMsg,
          bucketName: this.patientImportBucket,
        });
      } catch (error) {
        // don't capture or throw since this can be the same reason for failure on createPatientRecord
        const errorMsg = errorToString(error);
        log(`Failure while setting patient record to failed @ PatientImport. Cause: ${errorMsg}`);
        errorToUpdateRecordToFailed = errorMsg;
      }
      throw new MetriportError(msg, error, {
        cxId,
        jobId,
        rowNumber,
        context: "PatientImportCreateLocal.processPatientCreate",
        ...(errorToUpdateRecordToFailed
          ? { alsoFailedToUpdateRecordToFailed: true, errorToUpdateRecordToFailed }
          : {}),
      });
    }
  }
}
