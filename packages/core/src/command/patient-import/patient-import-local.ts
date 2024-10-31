import { chunk } from "lodash";
import { errorToString } from "@metriport/shared";
import { capture } from "../../util/notifications";
import { out } from "../../util/log";
import { createJobRecord } from "./commands/create-job-record";
import { validateAndParsePatientImportCsvFromS3 } from "./commands/validate-and-parse-import";
import { checkPatientRecordExists } from "./commands/check-patient-record-exists";
import { creatOrUpdatePatientRecord } from "./commands/create-or-update-patient-record";
import { startDocumentQuery } from "./commands/start-document-query";
import { createPatient } from "./commands/create-patient";
import { updateValidFileWithPatientId } from "./commands/update-valid-file-with-patient-id";
import { startPatientQuery } from "./commands/start-patient-query";
import {
  PatientImportHandler,
  StartPatientImportRequest,
  ProcessPatientImportRequest,
  ProcessPatientCreateRequest,
  ProcessPatientQueryRequest,
} from "./patient-import";
import { createPatientPayload } from "./patient-import-shared";

const patientCreateChunk = 1; // Mimics 1 patient at a time from the queue

export class PatientImportHandlerLocal implements PatientImportHandler {
  constructor(private readonly patientImportBucket: string) {}

  async startPatientImport({
    cxId,
    facilityId,
    jobId,
    rerunPdOnNewDemographics = true,
    dryrun = false,
  }: StartPatientImportRequest): Promise<void> {
    const { log } = out(`startPatientImport - cxId ${cxId} jobId ${jobId}`);
    try {
      const jobStartedAt = new Date().toISOString();
      const processPatientImportRequest: ProcessPatientImportRequest = {
        cxId,
        facilityId,
        jobId,
        jobStartedAt,
        s3BucketName: this.patientImportBucket,
        processPatientCreateQueue: "local",
        rerunPdOnNewDemographics,
        dryrun,
      };
      const boundProcessPatientImport = this.processPatientImport.bind(this);
      await boundProcessPatientImport(processPatientImportRequest);
    } catch (error) {
      const msg = `Failure while starting patient import @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-local.start-patient-import",
          error,
        },
      });
      throw error;
    }
  }

  async processPatientImport({
    cxId,
    facilityId,
    jobId,
    jobStartedAt,
    s3BucketName,
    rerunPdOnNewDemographics,
    dryrun,
  }: ProcessPatientImportRequest): Promise<void> {
    const { log } = out(`processPatientImport - cxId ${cxId} jobId ${jobId}`);
    try {
      await createJobRecord({
        cxId,
        jobId,
        jobStartedAt,
        data: { jobStartedAt },
        s3BucketName,
      });
      const patients = await validateAndParsePatientImportCsvFromS3({
        cxId,
        jobId,
        jobStartedAt,
        s3BucketName,
      });
      if (dryrun) {
        log(`Dryrun is true, returning...`);
        return;
      }
      const allOutcomes: PromiseSettledResult<void>[] = [];
      const patientChunks = chunk(patients, patientCreateChunk);
      for (const patientChunk of patientChunks) {
        const chunkOutcomes = await Promise.allSettled(
          patientChunk.map(async patientWithIndex => {
            const patientPayload = createPatientPayload(patientWithIndex.patient);
            const processPatientCreateRequest: ProcessPatientCreateRequest = {
              cxId,
              facilityId,
              jobId,
              jobStartedAt,
              patientPayload,
              patientRowIndex: patientWithIndex.rowIndex,
              s3BucketName: this.patientImportBucket,
              processPatientQueryQueue: "local",
              rerunPdOnNewDemographics,
              waitTimeInMillis: 0,
            };
            const boundProcessPatientCreate = this.processPatientCreate.bind(this);
            await boundProcessPatientCreate(processPatientCreateRequest);
          })
        );
        allOutcomes.push(...chunkOutcomes);
      }
      const hadFailure = allOutcomes.some(outcome => outcome.status === "rejected");
      if (hadFailure) throw new Error("At least one payload failed to create");
    } catch (error) {
      const msg = `Failure while processing patient import @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-local.process-patient-import",
          error,
        },
      });
      throw error;
    }
  }

  async processPatientCreate({
    cxId,
    facilityId,
    jobId,
    jobStartedAt,
    patientPayload,
    patientRowIndex,
    s3BucketName,
    rerunPdOnNewDemographics,
  }: ProcessPatientCreateRequest): Promise<void> {
    const { log } = out(`processPatientCreate - cxId ${cxId} jobId ${jobId}`);
    try {
      const patientDto = await createPatient({
        cxId,
        facilityId,
        patientPayload,
      });
      const patientId = patientDto.id;
      const recordExists = await checkPatientRecordExists({
        cxId,
        jobId,
        jobStartedAt,
        patientId,
        s3BucketName,
      });
      if (recordExists) {
        log(`Record exists for patientId ${patientId}, returning...`);
        return;
      }
      await creatOrUpdatePatientRecord({
        cxId,
        jobId,
        jobStartedAt,
        patientId,
        data: {
          patientPayload,
          patientRowIndex,
          patientDto,
        },
        s3BucketName,
      });
      await updateValidFileWithPatientId({
        cxId,
        jobId,
        jobStartedAt,
        patientId,
        patientRowIndex,
        s3BucketName,
      });
      const boundProcessPatientQuery = this.processPatientQuery.bind(this);
      await boundProcessPatientQuery({
        cxId,
        jobId,
        jobStartedAt,
        patientId,
        s3BucketName: this.patientImportBucket,
        rerunPdOnNewDemographics,
        waitTimeInMillis: 0,
      });
    } catch (error) {
      const msg = `Failure while processing patient create @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-local.process-patient-create",
          error,
        },
      });
      throw error;
    }
  }

  async processPatientQuery({
    cxId,
    jobId,
    jobStartedAt,
    patientId,
    s3BucketName,
    rerunPdOnNewDemographics,
  }: ProcessPatientQueryRequest) {
    const { log } = out(`processPatientQuery - cxId ${cxId} jobId ${jobId} patientId ${patientId}`);
    try {
      await startPatientQuery({
        cxId,
        patientId,
        rerunPdOnNewDemographics,
      });
      await startDocumentQuery({
        cxId,
        patientId,
      });
      await creatOrUpdatePatientRecord({
        cxId,
        jobId,
        jobStartedAt,
        patientId,
        data: { patientQueryStatus: "processing" },
        s3BucketName,
      });
    } catch (error) {
      const msg = `Failure while processing patient query @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          patientId,
          context: "patient-import-local.process-patient-query",
          error,
        },
      });
      throw error;
    }
  }
}
