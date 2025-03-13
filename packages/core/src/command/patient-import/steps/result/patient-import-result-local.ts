import { errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { executeAsynchronously } from "../../../../util/concurrency";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
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

  async processJobResult({ cxId, jobId, dryRun = false }: ProcessPatientResult) {
    const { log } = out(
      `PatientImport processJobResult.local - cxId ${cxId} jobId ${jobId} dryRun ${dryRun}`
    );
    try {
      const resultEntries = await getResultEntries({
        cxId,
        jobId,
        patientImportBucket: this.patientImportBucket,
      });
      await storeResults({
        cxId,
        jobId,
        resultEntries,
        bucketName: this.patientImportBucket,
      });

      await updateJobAtApi({ cxId, jobId, status: "completed" });

      // TODO: Send webhook notification
      // processPatientImportWebhook(cxId, patientImport.id, "completed");
      log(`>>>> Would send webhook notification here <<<<`);

      log(`Result completed successfully`);
    } catch (error) {
      const msg = `Failure while processing job result @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-result-local.processJobResult",
          error,
        },
      });
      await updateJobAtApi({ cxId, jobId, status: "failed" });
      throw error;
    }
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
  const records: PatientRecord[] = [];
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
  const file = await s3Utils.getFileContentsAsString(bucketName, key);
  return JSON.parse(file);
}
