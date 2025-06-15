import { errorToString, sleep } from "@metriport/shared";
import { isDryRun } from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk, partition } from "lodash";
import { capture, out } from "../../../../util";
import { updateJobAtApi } from "../../api/update-job-status";
import { validateAndParsePatientImportCsvFromS3 } from "../../csv/validate-and-parse-import";
import { reasonForCxInternalError } from "../../patient-import-shared";
import { setPatientOrRecordFailed } from "../../patient-or-record-failed";
import { PatientImportCreate, ProcessPatientCreateRequest } from "../create/patient-import-create";
import { PatientImportResult } from "../result/patient-import-result";
import { PatientImportParseRequest } from "./patient-import-parse";

dayjs.extend(duration);

// CURRENT: a chunk w/ 5 patients every 20ms is 250 patients per second -> 225,000 in 15min (the lambda timeout)
const sleepBetweenPatientCreateChunks = dayjs.duration(20, "milliseconds");
const patientCreateChunkSize = 5;

export type ProcessJobParseCommandRequest = PatientImportParseRequest & {
  patientImportBucket: string;
  next: PatientImportCreate;
  result: PatientImportResult;
};

export async function processJobParse({
  cxId,
  jobId,
  forceStatusUpdate,
  patientImportBucket,
  next,
  result,
}: ProcessJobParseCommandRequest): Promise<void> {
  const { log } = out(`processJobParse cmd - cxId ${cxId} jobId ${jobId}`);
  const context = "PatientImportParse.processJobParseCommand";
  try {
    const s3BucketName = patientImportBucket;

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
      await result.processJobResult({ cxId, jobId });
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
            await next.processPatientCreate(processPatientCreateRequest);
          } catch (error) {
            const msg =
              `Failure while sending payload to patient create queue @ PatientImport (rowNumber: ${rowNumber}). ` +
              `Cause: ${errorToString(error)}`;
            log(msg);
            errors.push(error);
            await setPatientOrRecordFailed({
              cxId,
              jobId,
              rowNumber,
              reasonForCx: reasonForCxInternalError,
              reasonForDev: msg,
              bucketName: patientImportBucket,
            });
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
          context,
          amountOfErrors: errors.length,
          errors: errorsAsString,
        },
      });
    }
  } catch (error) {
    const msg = `Failure while parsing the job of patient import @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    await updateJobAtApi({ cxId, jobId, status: "failed" });
    capture.setExtra({
      cxId,
      jobId,
      context,
      error,
    });
    throw error;
  }
}
