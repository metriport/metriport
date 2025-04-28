import { errorToString, sleep } from "@metriport/shared";
import { isDryRun } from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk, partition } from "lodash";
import { capture, out } from "../../../../util";
import { updateJobAtApi } from "../../api/update-job-status";
import { validateAndParsePatientImportCsvFromS3 } from "../../csv/validate-and-parse-import";
import { reasonForCxInternalError } from "../../patient-import-shared";
import { updatePatientRecord } from "../../record/create-or-update-patient-record";
import { PatientImportCreate, ProcessPatientCreateRequest } from "../create/patient-import-create";
import { buildPatientImportCreateHandler } from "../create/patient-import-create-factory";
import { PatientImportResult } from "../result/patient-import-result";
import { buildPatientImportResult } from "../result/patient-import-result-factory";
import { PatientImportParse, PatientImportParseRequest } from "./patient-import-parse";

dayjs.extend(duration);

// CURRENT: a chunk w/ 5 patients every 20ms is 250 patients per second -> 225,000 in 15min (the lambda timeout)
const sleepBetweenPatientCreateChunks = dayjs.duration(20, "milliseconds");
const patientCreateChunkSize = 5;

export class PatientImportParseLocal implements PatientImportParse {
  constructor(
    private readonly patientImportBucket: string,
    private readonly next: PatientImportCreate = buildPatientImportCreateHandler(),
    private readonly result: PatientImportResult = buildPatientImportResult()
  ) {}

  async processJobParse({
    cxId,
    jobId,
    forceStatusUpdate,
  }: PatientImportParseRequest): Promise<void> {
    const { log } = out(`PatientImport processJobParse.local - cxId ${cxId} jobId ${jobId}`);
    try {
      const s3BucketName = this.patientImportBucket;

      const job = await updateJobAtApi({ cxId, jobId, status: "processing", forceStatusUpdate });

      const { facilityId } = job;
      const { triggerConsolidated, disableWebhooks, rerunPdOnNewDemographics } = job.paramsOps;
      const dryRun = isDryRun(job);

      const patients = await validateAndParsePatientImportCsvFromS3({
        cxId,
        jobId,
        s3BucketName,
      });
      const [successful, failed] = partition(patients, p => (p.status !== "failed" ? true : false));

      await updateJobAtApi({
        cxId,
        jobId,
        status: "processing",
        total: successful.length + failed.length,
        failed: failed.length,
      });

      if (dryRun) {
        log(`dryRun is true, calling result...`);
        await this.result.processJobResult({ cxId, jobId });
        return;
      }

      const errors: unknown[] = [];
      const patientChunks = chunk(successful, patientCreateChunkSize);
      for (const patientChunk of patientChunks) {
        await Promise.allSettled(
          patientChunk.map(async parsedPatient => {
            const { rowNumber } = parsedPatient;
            const processPatientCreateRequest: ProcessPatientCreateRequest = {
              cxId,
              facilityId,
              jobId,
              rowNumber,
              triggerConsolidated,
              disableWebhooks,
              rerunPdOnNewDemographics,
            };
            try {
              await this.next.processPatientCreate(processPatientCreateRequest);
            } catch (error) {
              const msg = `Failure while sending payload to patient create queue @ PatientImport`;
              log(`${msg} (rowNumber: ${rowNumber}). Cause: ${errorToString(error)}`);
              errors.push(error);
              try {
                await updatePatientRecord({
                  cxId,
                  jobId,
                  rowNumber,
                  status: "failed",
                  reasonForCx: reasonForCxInternalError,
                  reasonForDev: errorToString(error),
                  bucketName: this.patientImportBucket,
                });
              } catch (error) {
                const msg = `Double failure while updating patient record @ PatientImport`;
                log(`${msg} (rowNumber: ${rowNumber}). Cause: ${errorToString(error)}`);
                errors.push(error);
              }
            }
          })
        );
        await sleep(sleepBetweenPatientCreateChunks.asMilliseconds());
      }
      if (errors.length > 0) {
        const msg = "At least one call to processPatientCreate failed";
        const errorsAsString = errors.map(e => errorToString(e));
        log(`${msg}. Errors (${errors.length}): ${errorsAsString.join("; ")}`);
        capture.error(msg, {
          extra: {
            cxId,
            jobId,
            context: "PatientImportParseLocal.processJobParse",
            amountOfErrors: errors.length,
            errors: errorsAsString,
          },
        });
        // intentionally swallowing the error here, since we don't have visibility over the
        // patients that were created or not, so we don't set the job status to failed
      }
    } catch (error) {
      const msg = `Failure while parsing the job of patient import @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      await updateJobAtApi({ cxId, jobId, status: "failed" });
      capture.setExtra({
        cxId,
        jobId,
        context: "PatientImportParseLocal.processJobParse",
        error,
      });
      throw error;
    }
  }
}
