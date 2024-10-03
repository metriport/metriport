import { uuidv4 } from "../../util/uuid-v7";
import { executeAsynchronously } from "../../util/concurrency";
import { creatUploadHistory } from "./commands/create-upload-history";
import { getValidPatientsFromImport } from "./commands/validate-and-parse-import";
import { checkUploadRecord } from "./commands/check-upload-record";
import { creatOrUpdateUploadRecord } from "./commands/create-or-update-upload-record";
import { startDocumentQuery } from "./commands/start-document-query";
import { createPatient } from "./commands/create-patient";
import { startPatientDiscovery } from "./commands/start-patient-discovery";
import {
  PatientImportHandler,
  StartImportRequest,
  ProcessFileRequest,
  ProcessPatientCreateRequest,
  ProcessPatientDiscoveryRequest,
} from "./patient-import";
import { createPatientPayload } from "./patient-import-shared";
import { Config } from "../../util/config";

const patientImportBucket = Config.getPatientImportBucket();

export class PatientImportHandlerLocal implements PatientImportHandler {
  async startImport({
    cxId,
    facilityId,
    s3BucketName,
    s3FileName,
    dryrun = false,
    rerunPdOnNewDemographics = true,
  }: StartImportRequest): Promise<void> {
    if (!patientImportBucket) throw new Error("Patient import bucket not setup.");
    const jobId = uuidv4();
    await creatUploadHistory({
      cxId,
      jobId,
      patientImportBucket,
      s3FileName,
    });
    await this.processFile({
      cxId,
      facilityId,
      jobId,
      s3BucketName,
      s3FileName,
      fileType: "csv", // TODO Parse extension
      dryrun,
      rerunPdOnNewDemographics,
    });
  }

  async processFile({
    cxId,
    facilityId,
    jobId,
    s3BucketName,
    s3FileName,
    fileType,
    dryrun,
    rerunPdOnNewDemographics,
  }: ProcessFileRequest): Promise<void> {
    if (!patientImportBucket) throw new Error("Patient import bucket not setup.");
    const patients = await getValidPatientsFromImport({ s3BucketName, s3FileName, fileType });
    if (dryrun) return;
    const processPatientCreateRequests: ProcessPatientCreateRequest[] = patients.map(patient => {
      const patientPayload = createPatientPayload(patient);
      return {
        cxId,
        facilityId,
        jobId,
        patientPayload,
        patientImportBucket,
        rerunPdOnNewDemographics,
      };
    });
    await executeAsynchronously(processPatientCreateRequests, this.processPatientCreate, {
      numberOfParallelExecutions: 10,
    });
  }

  async processPatientCreate({
    cxId,
    facilityId,
    jobId,
    patientPayload,
    patientImportBucket,
    rerunPdOnNewDemographics,
  }: ProcessPatientCreateRequest): Promise<void> {
    const patientId = await createPatient({
      cxId,
      facilityId,
      patientPayload,
    });
    const patientAlreadyProcessed = await checkUploadRecord({
      cxId,
      jobId,
      patientId,
      patientImportBucket,
    });
    if (patientAlreadyProcessed) return;
    await creatOrUpdateUploadRecord({
      cxId,
      jobId,
      patientId,
      patientImportBucket,
    });
    await this.processPatientDiscovery({
      cxId,
      facilityId,
      jobId,
      patientId,
      patientImportBucket,
      rerunPdOnNewDemographics,
    });
  }

  async processPatientDiscovery({
    cxId,
    facilityId,
    jobId,
    patientId,
    patientImportBucket,
    rerunPdOnNewDemographics,
  }: ProcessPatientDiscoveryRequest) {
    await startPatientDiscovery({
      cxId,
      facilityId,
      patientId,
      rerunPdOnNewDemographics,
    });
    await startDocumentQuery({
      cxId,
      patientId,
    });
    await creatOrUpdateUploadRecord({
      cxId,
      jobId,
      patientId,
      data: { patientDiscoveryStatus: "processing" },
      patientImportBucket,
    });
  }
}
