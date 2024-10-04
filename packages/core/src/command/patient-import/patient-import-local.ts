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
  StartPatientImportRequest,
  ProcessPatientImportRequest,
  ProcessPatientCreateRequest,
  ProcessPatientQueryRequest,
} from "./patient-import";
import { createPatientPayload } from "./patient-import-shared";

export class PatientImportHandlerLocal implements PatientImportHandler {
  constructor(private readonly patientImportBucket: string) {}

  async startPatientImport({
    cxId,
    facilityId,
    jobId,
    rerunPdOnNewDemographics = true,
    dryrun = false,
  }: StartPatientImportRequest): Promise<void> {
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
        s3BucketName: this.patientImportBucket,
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
      s3BucketName: this.patientImportBucket,
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
