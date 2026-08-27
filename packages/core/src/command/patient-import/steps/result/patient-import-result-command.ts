import { errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { setS3UsePathStyle } from "../../../../external/aws/s3";
import { executeAsynchronously } from "../../../../util/concurrency";
import { out } from "../../../../util/log";
import { updateJobAtApi } from "../../api/update-job-status";
import { ResultEntry, storeResults } from "../../csv/store-results";
import { PatientRecord } from "../../patient-import";
import { getS3UtilsInstance } from "../../patient-import-shared";
import { listPatientRecords } from "../../record/list-patient-records";
import { ProcessPatientResult } from "./patient-import-result";

dayjs.extend(duration);

const numberOfParallelExecutions = 20;

export type ProcessPatientResultCommandRequest = ProcessPatientResult & {
  patientImportBucket: string;
};

export async function processPatientResult({
  cxId,
  jobId,
  patientImportBucket,
}: ProcessPatientResultCommandRequest): Promise<void> {
  const { log } = out(`processJobResult cmd - cxId ${cxId} jobId ${jobId}`);
  try {
    setS3UsePathStyle(true);

    const resultEntries = await getResultEntries({
      cxId,
      jobId,
      patientImportBucket: patientImportBucket,
    });
    await storeResults({
      cxId,
      jobId,
      resultEntries,
      bucketName: patientImportBucket,
    });

    await updateJobAtApi({ cxId, jobId, status: "completed" });

    log(`Result completed successfully`);
  } catch (error) {
    const msg = `Failure while processing job result @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    await updateJobAtApi({ cxId, jobId, status: "failed" });
    throw error;
  }
}

export async function getResultEntries({
  cxId,
  jobId,
  patientImportBucket,
}: {
  cxId: string;
  jobId: string;
  patientImportBucket: string;
}): Promise<ResultEntry[]> {
  const patientRecordKeys = await listPatientRecords({
    cxId,
    jobId,
    bucketName: patientImportBucket,
  });
  const resultEntries: ResultEntry[] = [];
  await executeAsynchronously(
    patientRecordKeys,
    async key => {
      const patientRecord = await loadPatientRecord(key, patientImportBucket);
      resultEntries.push({
        rowNumber: patientRecord.rowNumber,
        rowCsv: patientRecord.rowCsv,
        status: patientRecord.status,
        patientId: patientRecord.patientId,
        reasonForCx: patientRecord.status === "failed" ? patientRecord.reasonForCx : undefined,
        reasonForDev: patientRecord.status === "failed" ? patientRecord.reasonForDev : undefined,
      });
    },
    {
      numberOfParallelExecutions,
    }
  );
  return resultEntries;
}

async function loadPatientRecord(key: string, bucketName: string): Promise<PatientRecord> {
  const s3Utils = getS3UtilsInstance();
  const contents = await s3Utils.getFileContentsAsStringV3({ bucketName, key });
  return JSON.parse(contents);
}
