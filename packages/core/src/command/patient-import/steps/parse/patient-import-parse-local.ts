import { errorToString, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk } from "lodash";
import { capture, out } from "../../../../util";
import { createPatientPayload } from "../../patient-import-shared";
import { fetchJobRecordOrFail } from "../../record/fetch-job-record";
import { validateAndParsePatientImportCsvFromS3 } from "../../record/validate-and-parse-import";
import {
  PatientImportCreateHandler,
  ProcessPatientCreateRequest,
} from "../create/patient-import-create";
import { buildPatientImportCreateHandler } from "../create/patient-import-create-factory";
import { PatientImportParseHandler, StartPatientImportRequest } from "./patient-import-parse";

dayjs.extend(duration);

// CURRENT: a chunk w/ 5 patients every 20ms is 250 patients per second -> 225,000 in 15min (the lambda timeout)
const sleepBetweenPatientCreateChunks = dayjs.duration(20, "milliseconds");
const patientCreateChunk = 5;

export class PatientImportParseLocal implements PatientImportParseHandler {
  constructor(
    private readonly patientImportBucket: string,
    private readonly next: PatientImportCreateHandler = buildPatientImportCreateHandler()
  ) {}

  async processJobParse({
    cxId,
    jobId,
    triggerConsolidated = false,
    disableWebhooks = false,
    rerunPdOnNewDemographics,
    dryRun: dryRunFromInternal,
  }: StartPatientImportRequest): Promise<void> {
    const { log } = out(`processJobParse.local - cxId ${cxId} jobId ${jobId}`);
    try {
      const s3BucketName = this.patientImportBucket;
      const jobRecord = await fetchJobRecordOrFail({ cxId, jobId, s3BucketName });
      const patients = await validateAndParsePatientImportCsvFromS3({
        cxId,
        jobId,
        s3BucketName,
      });
      const { facilityId, dryRun: dryRunFromCreate } = jobRecord;
      const dryRun = dryRunFromInternal != undefined ? dryRunFromInternal : dryRunFromCreate;
      if (dryRun) {
        // TODO 2330 provide feedback to cx about the parsing of the file
        log(`dryRun is true, returning...`);
        return;
      }
      const allOutcomes: PromiseSettledResult<void>[] = [];
      const patientChunks = chunk(patients, patientCreateChunk);
      for (const patientChunk of patientChunks) {
        const chunkOutcomes = await Promise.allSettled(
          patientChunk.map(async patient => {
            const patientPayload = createPatientPayload(patient);
            const processPatientCreateRequest: ProcessPatientCreateRequest = {
              cxId,
              facilityId,
              jobId,
              patientPayload,
              triggerConsolidated,
              disableWebhooks,
              rerunPdOnNewDemographics,
            };
            try {
              await this.next.processPatientCreate(processPatientCreateRequest);
            } catch (error) {
              const msg = `Failure while sending payload to patient create queue @ PatientImport`;
              log(`${msg}. Cause: ${errorToString(error)}`);
              capture.error(msg, {
                extra: {
                  cxId,
                  jobId,
                  processPatientCreateRequest,
                  context: "patient-import-parse-local.call.patient-create",
                  error,
                },
              });
              throw error;
            }
          })
        );
        allOutcomes.push(...chunkOutcomes);
        await sleep(sleepBetweenPatientCreateChunks.asMilliseconds());
      }
      const hadFailure = allOutcomes.some(outcome => outcome.status === "rejected");
      if (hadFailure) throw new Error("At least one payload failed to send to create queue");
    } catch (error) {
      const msg = `Failure while parsing the job of patient import @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-parse-local.processJobParse",
          error,
        },
      });
      throw error;
    }
  }
}
