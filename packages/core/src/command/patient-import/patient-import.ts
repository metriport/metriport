import { PatientDemoData } from "../../domain/patient";

export type PhaseStatus = "processing" | "completed" | "failed";

export type PatientRecord = {
  patientId: string;
  patientQueryStatus?: PhaseStatus;
  documentQueryStatus?: PhaseStatus;
  documentRetrevialStatus?: PhaseStatus;
  documentConversionStatus?: PhaseStatus;
  cleanUpStatus?: PhaseStatus;
};

export type PatientRecordUpdate = Omit<PatientRecord, "patientId">;

export type JobRecord = {
  jobStartedAt: string;
};

export type JobRecordUpdate = JobRecord;

export type StartPatientImportRequest = {
  cxId: string;
  facilityId: string;
  jobId: string;
  processPatientImportLambda: string;
  triggerConsolidated?: boolean;
  rerunPdOnNewDemographics?: boolean;
  dryrun?: boolean;
};

export type ProcessPatientImportRequest = {
  cxId: string;
  facilityId: string;
  jobId: string;
  jobStartedAt: string;
  s3BucketName: string;
  processPatientCreateQueue: string;
  triggerConsolidated: boolean;
  rerunPdOnNewDemographics: boolean;
  dryrun: boolean;
};

export type PatientPayload = PatientDemoData & { externalId: string | undefined };

export type ProcessPatientCreateRequest = {
  cxId: string;
  facilityId: string;
  jobId: string;
  jobStartedAt: string;
  patientPayload: PatientPayload;
  s3BucketName: string;
  processPatientQueryQueue: string;
  triggerConsolidated: boolean;
  rerunPdOnNewDemographics: boolean;
  waitTimeInMillis: number;
};

export type ProcessPatientQueryRequest = {
  cxId: string;
  jobId: string;
  jobStartedAt: string;
  patientId: string;
  s3BucketName: string;
  triggerConsolidated: boolean;
  rerunPdOnNewDemographics: boolean;
  waitTimeInMillis: number;
};

export interface PatientImportHandler {
  startPatientImport(request: StartPatientImportRequest): Promise<void>;
  processPatientImport(request: ProcessPatientImportRequest): Promise<void>;
  processPatientCreate(request: ProcessPatientCreateRequest): Promise<void>;
  processPatientQuery(request: ProcessPatientQueryRequest): Promise<void>;
}
