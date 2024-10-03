import { PatientDemoData } from "../../domain/patient";

export type PhaseStatus = "processing" | "completed" | "failed";

export type UploadRecord = {
  patientId: string;
  patientDiscoveryStatus?: PhaseStatus;
  documentQueryStatus?: PhaseStatus;
  documentRetrevialStatus?: PhaseStatus;
  documentConversionStatus?: PhaseStatus;
  cleanUpStatus?: PhaseStatus;
};

export type UploadRecordUpdate = Omit<UploadRecord, "patientId">;

export type StartImportRequest = {
  cxId: string;
  jobId: string;
  s3BucketName: string;
  s3FileName: string;
};

export type ProcessFileRequest = {
  cxId: string;
  jobId: string;
  s3BucketName: string;
  s3FileName: string;
  fileType: "csv";
};

export type PatientPayload = PatientDemoData & { externalId: string | undefined };

export type ProcessPatientCreateRequest = {
  cxId: string;
  jobId: string;
  patientPayload: PatientPayload;
  s3BucketName: string;
};

export type ProcessPatientDiscoveryRequest = {
  cxId: string;
  jobId: string;
  patientId: string;
  s3BucketName: string;
};

export interface PatientImportHandler {
  startImport(request: StartImportRequest): Promise<void>;
  processFile(request: ProcessFileRequest): Promise<void>;
  processPatientCreate(request: ProcessPatientCreateRequest): Promise<void>;
  processPatientDiscovery(request: ProcessPatientDiscoveryRequest): Promise<void>;
}
