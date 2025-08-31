import { errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { executeWithRetriesS3 } from "../../../../external/aws/s3";
import { executeAsynchronously } from "../../../../util/concurrency";
import { out } from "../../../../util/log";
import { updateJobAtApi } from "../../api/update-job-status";
import { ResultEntry, storeResults } from "../../csv/store-results";
import { PatientRecord } from "../../patient-import";
import { getS3UtilsInstance } from "../../patient-import-shared";
import { listPatientRecords } from "../../record/list-patient-records";
import { PatientImportResult, ProcessPatientResult } from "./patient-import-result";

dayjs.extend(duration);

const numberOfParallelExecutions = 20;

export class PatientImportResultLocal implements PatientImportResult {
  constructor(private readonly patientImportBucket: string) {}

  /**
   * Consolidates the individual patient records into a single file and updates the job status at
   * the API (which might do other things, like sending WH requests).
   */
  async processJobResult({ cxId, jobId }: ProcessPatientResult): Promise<void> {
    const { log } = out(`PatientImport processJobResult.local - cxId ${cxId} jobId ${jobId}`);
    try {
      const resultEntries = await getResultEntries({
        cxId,
        jobId,
        patientImportBucket: this.patientImportBucket,
        log,
      });
      await storeResults({
        cxId,
        jobId,
        resultEntries,
        bucketName: this.patientImportBucket,
      });

      await updateJobAtApi({ cxId, jobId, status: "completed" });

      log(`Result completed successfully`);
    } catch (error) {
      const msg = `Failure while processing job result @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      await updateJobAtApi({ cxId, jobId, status: "failed", throwOnFailure: false });
      throw error;
    }
  }
}

export async function getResultEntries({
  cxId,
  jobId,
  patientImportBucket,
  log,
}: {
  cxId: string;
  jobId: string;
  patientImportBucket: string;
  log: typeof console.log;
}): Promise<ResultEntry[]> {
  const startTime = Date.now();
  log(`Listing patient records...`);
  const patientRecordKeys = await listPatientRecords({
    cxId,
    jobId,
    bucketName: patientImportBucket,
  });
  const records: PatientRecord[] = [];
  log(`Found ${patientRecordKeys.length} patient records, loading their contents...`);
  await executeAsynchronously(
    patientRecordKeys,
    async key => {
      const patientRecord = await loadPatientRecord(key, patientImportBucket);
      records.push(patientRecord);
    },
    {
      numberOfParallelExecutions,
    }
  );
  log(`Done loading ${patientRecordKeys.length} patient records in ${Date.now() - startTime}ms`);
  const resultEntries: ResultEntry[] = records.map(r => {
    return {
      rowNumber: r.rowNumber,
      rowCsv: r.rowCsv,
      status: r.status,
      patientId: r.patientId,
      reason: r.status === "failed" ? r.reasonForCx : undefined,
    };
  });
  return resultEntries;
}

async function loadPatientRecord(key: string, bucketName: string): Promise<PatientRecord> {
  const s3Utils = getS3UtilsInstance();
  const file = await executeWithRetriesS3(async () =>
    s3Utils.getFileContentsAsString(bucketName, key)
  );
  return JSON.parse(file);
}
