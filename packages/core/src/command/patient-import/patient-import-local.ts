import { sleep } from "@metriport/shared";
import { executeAsynchronously } from "../../util/concurrency";
import { createJobRecord } from "./commands/create-job-record";
import { validateAndParsePatientImportCsv } from "./commands/validate-and-parse-import";
import { checkPatientRecord } from "./commands/check-patient-record";
import { creatOrUpdatePatientRecord } from "./commands/create-or-update-patient-record";
import { startDocumentQuery } from "./commands/start-document-query";
import { createPatient } from "./commands/create-patient";
import { startPatientQuery } from "./commands/start-patient-query";
import {
  PatientImportHandler,
  StartImportRequest,
  ProcessFileRequest,
  ProcessPatientCreateRequest,
  ProcessPatientQueryRequest,
} from "./patient-import";
import { createPatientPayload } from "./patient-import-shared";
import { Config } from "../../util/config";

const patientImportBucket = Config.getPatientImportBucket();

export class PatientImportHandlerLocal implements PatientImportHandler {
  async startImport({
    cxId,
    facilityId,
    jobId,
    rerunPdOnNewDemographics = true,
    dryrun = false,
  }: StartImportRequest): Promise<void> {
    if (!patientImportBucket) throw new Error("patientImportBucket not setup");
    const jobStartedAt = new Date().toISOString();
    const processFileRequest: ProcessFileRequest = {
      cxId,
      facilityId,
      jobId,
      jobStartedAt,
      s3BucketName: patientImportBucket,
      processPatientCreateQueue: "local",
      rerunPdOnNewDemographics,
      dryrun,
    };
    const boundProcessFile = this.processFile.bind(this);
    await boundProcessFile(processFileRequest);
  }

  async processFile({
    cxId,
    facilityId,
    jobId,
    jobStartedAt,
    s3BucketName,
    rerunPdOnNewDemographics,
    dryrun,
  }: ProcessFileRequest): Promise<void> {
    if (!patientImportBucket) throw new Error("patientImportBucket not setup");
    await createJobRecord({
      cxId,
      jobId,
      data: { jobStartedAt },
      s3BucketName,
    });
    const patients = await validateAndParsePatientImportCsv({
      cxId,
      jobId,
      s3BucketName,
    });
    if (dryrun) return;
    const processPatientCreateRequests: ProcessPatientCreateRequest[] = patients.map(patient => {
      const patientPayload = createPatientPayload(patient);
      return {
        cxId,
        facilityId,
        jobId,
        patientPayload,
        s3BucketName: patientImportBucket,
        processPatientQueryQueue: "local",
        rerunPdOnNewDemographics,
      };
    });
    const boundProcessPatientCreate = this.processPatientCreate.bind(this);
    await executeAsynchronously(processPatientCreateRequests, boundProcessPatientCreate, {
      numberOfParallelExecutions: 10,
    });
  }

  async processPatientCreate({
    cxId,
    facilityId,
    jobId,
    patientPayload,
    s3BucketName,
    rerunPdOnNewDemographics,
  }: ProcessPatientCreateRequest): Promise<void> {
    if (!patientImportBucket) throw new Error("patientImportBucket not setup");
    const patientId = await createPatient({
      cxId,
      facilityId,
      patientPayload,
    });
    const patientAlreadyProcessed = await checkPatientRecord({
      cxId,
      jobId,
      patientId,
      s3BucketName,
    });
    if (patientAlreadyProcessed) return;
    await creatOrUpdatePatientRecord({
      cxId,
      jobId,
      patientId,
      s3BucketName,
    });
    await this.processPatientQuery({
      cxId,
      jobId,
      patientId,
      s3BucketName: patientImportBucket,
      rerunPdOnNewDemographics,
      waitTimeInMillis: 0,
    });
  }

  async processPatientQuery({
    cxId,
    jobId,
    patientId,
    s3BucketName,
    rerunPdOnNewDemographics,
    waitTimeInMillis,
  }: ProcessPatientQueryRequest) {
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
      patientId,
      data: { patientQueryStatus: "processing" },
      s3BucketName,
    });
    if (waitTimeInMillis > 0) sleep(waitTimeInMillis);
  }
}
