import { uuidv4 } from "../../util/uuid-v7";
import { executeAsynchronously } from "../../util/concurrency";
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
import { createPatientPayload } from "./shared";

export class PatientImportHandlerDirect implements PatientImportHandler {
  async startImport({ cxId, s3BucketName, s3FileName }: StartImportRequest): Promise<void> {
    const jobId = uuidv4();
    await this.processFile({
      cxId,
      jobId,
      s3BucketName,
      s3FileName,
      fileType: "csv", // TODO Parse extension
    });
  }

  async processFile({
    cxId,
    jobId,
    s3BucketName,
    s3FileName,
    fileType,
  }: ProcessFileRequest): Promise<void> {
    const patients = await getValidPatientsFromImport({ s3BucketName, s3FileName, fileType });
    const processPatientRequests: ProcessPatientCreateRequest[] = patients.map(patient => {
      const patientPayload = createPatientPayload(patient);
      return {
        cxId,
        jobId,
        patientPayload,
        s3BucketName,
      };
    });
    await executeAsynchronously(processPatientRequests, this.processPatientCreate, {
      numberOfParallelExecutions: 10,
    });
  }

  async processPatientCreate({
    cxId,
    jobId,
    patientPayload,
    s3BucketName,
  }: ProcessPatientCreateRequest): Promise<void> {
    const patientId = await createPatient({
      cxId,
      patientPayload,
    });
    const patientAlreadyProcessed = await checkUploadRecord({
      cxId,
      jobId,
      patientId,
      s3BucketName,
    });
    if (patientAlreadyProcessed) return;
    await creatOrUpdateUploadRecord({
      cxId,
      jobId,
      patientId,
      s3BucketName,
    });
    await this.processPatientDiscovery({
      cxId,
      jobId,
      patientId,
      s3BucketName,
    });
  }

  async processPatientDiscovery({
    cxId,
    jobId,
    patientId,
    s3BucketName,
  }: ProcessPatientDiscoveryRequest) {
    await startPatientDiscovery({
      cxId,
      patientId,
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
      s3BucketName,
    });
  }
}
