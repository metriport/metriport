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
  facilityId: string;
  s3BucketName: string;
  s3FileName: string;
  rerunPdOnNewDemographics?: boolean;
  dryrun?: boolean;
};

export type ProcessFileRequest = {
  cxId: string;
  facilityId: string;
  jobId: string;
  s3BucketName: string;
  s3FileName: string;
  fileType: "csv";
  rerunPdOnNewDemographics: boolean;
  dryrun: boolean;
};

export type PatientPayload = PatientDemoData & { externalId: string | undefined };

export type ProcessPatientCreateRequest = {
  cxId: string;
  facilityId: string;
  jobId: string;
  patientPayload: PatientPayload;
  patientImportBucket: string;
  rerunPdOnNewDemographics: boolean;
};

export type ProcessPatientDiscoveryRequest = {
  cxId: string;
  facilityId: string;
  jobId: string;
  patientId: string;
  patientImportBucket: string;
  rerunPdOnNewDemographics: boolean;
  timeout?: number;
};

export interface PatientImportHandler {
  startImport(request: StartImportRequest): Promise<void>;
  processFile(request: ProcessFileRequest): Promise<void>;
  processPatientCreate(request: ProcessPatientCreateRequest): Promise<void>;
  processPatientDiscovery(request: ProcessPatientDiscoveryRequest): Promise<void>;
}
