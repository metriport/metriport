import { errorToString, MetriportError, sleep } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { out } from "../../../../util/log";
import { createPatient } from "../../api/create-patient";
import { createPatientMapping } from "../../api/create-patient-mapping";
import { updateJobAtApi } from "../../api/update-job-status";
import { reasonForCxInternalError } from "../../patient-import-shared";
import { updatePatientRecord } from "../../record/create-or-update-patient-record";
import { PatientImportQuery, ProcessPatientQueryRequest } from "../query/patient-import-query";
import { buildPatientImportQueryHandler } from "../query/patient-import-query-factory";
import { ProcessPatientCreateRequest } from "./patient-import-create";

export type ProcessPatientCreateCommandRequest = ProcessPatientCreateRequest & {
  patientImportBucket: string;
  waitTimeInMillis: number;
  next?: PatientImportQuery;
};

export async function processPatientCreate({
  cxId,
  facilityId,
  jobId,
  rowNumber,
  rerunPdOnNewDemographics,
  triggerConsolidated,
  disableWebhooks,
  patientImportBucket,
  waitTimeInMillis,
  next = buildPatientImportQueryHandler(),
}: ProcessPatientCreateCommandRequest): Promise<void> {
  const { log } = out(`processPatientCreate cmd - cxId ${cxId} jobId ${jobId}`);
  try {
    const patientRecord = await updatePatientRecord({
      cxId,
      jobId,
      rowNumber,
      status: "processing",
      bucketName: patientImportBucket,
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
        bucketName: patientImportBucket,
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
    await next.processPatientQuery(processPatientQueryRequest);

    if (waitTimeInMillis > 0) await sleep(waitTimeInMillis);
  } catch (error) {
    const msg = `Failure while processing patient create @ PatientImport`;
    const errorMsg = errorToString(error);
    log(`${msg}. Cause: ${errorMsg}`);
    let errorToUpdateRecordToFailed: string | undefined = undefined;
    try {
      await Promise.all([
        updateJobAtApi({ cxId, jobId, status: "failed", failed: 1 }),
        updatePatientRecord({
          cxId,
          jobId,
          rowNumber,
          status: "failed",
          reasonForCx: reasonForCxInternalError,
          reasonForDev: errorMsg,
          bucketName: patientImportBucket,
        }),
      ]);
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
