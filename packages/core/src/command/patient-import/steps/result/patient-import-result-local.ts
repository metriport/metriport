import { errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { executeAsynchronously } from "../../../../util/concurrency";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { updateJobStatus } from "../../api/update-job-status";
import { ResultEntry, storeResults } from "../../csv/store-results";
import { PatientRecord } from "../../patient-import";
import { getS3UtilsInstance } from "../../patient-import-shared";
import { listPatientRecords } from "../../record/list-patient-records";
import { PatientImportResult, ProcessPatientResult } from "./patient-import-result";
dayjs.extend(duration);

const numberOfParallelExecutions = 20;

export class PatientImportResultLocal implements PatientImportResult {
  constructor(private readonly patientImportBucket: string) {}

  async processPatientResult({ cxId, jobId, dryRun = false }: ProcessPatientResult) {
    const { log } = out(
      `PatientImport processPatientResult.local - cxId ${cxId} jobId ${jobId} dryRun ${dryRun}`
    );
    try {
      const patientRecordKeys = await listPatientRecords({
        cxId,
        jobId,
        bucketName: this.patientImportBucket,
      });
      const records: PatientRecord[] = [];
      await executeAsynchronously(
        patientRecordKeys,
        async key => {
          const patientRecord = await this.loadPatientRecord(key);
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
      await storeResults({
        cxId,
        jobId,
        resultEntries,
        bucketName: this.patientImportBucket,
      });

      if (!dryRun) {
        await updateJobStatus({ cxId, jobId, status: "completed" });
      }

      log(`Result completed successfully`);
    } catch (error) {
      const msg = `Failure while processing patient result @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-result-local.processPatientResult",
          error,
        },
      });
      await updateJobStatus({ cxId, jobId, status: "failed" });
      // TODO 2330 expected state to not have the result file when status is failed?
      throw error;
    }
  }
  private async loadPatientRecord(key: string): Promise<PatientRecord> {
    const s3Utils = getS3UtilsInstance();
    const file = await s3Utils.getFileContentsAsString(this.patientImportBucket, key);
    return JSON.parse(file);
  }
}
