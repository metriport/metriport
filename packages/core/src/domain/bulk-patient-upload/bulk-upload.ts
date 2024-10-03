import { PatientDemoData } from "../patient";

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

export type ProcessFileRequest = {
  requestId: string;
  cxId: string;
  fileName: string;
  bucket: string;
  fileType: "csv";
};

export type PatientPayload = PatientDemoData & { externalId: string | undefined };

export type ProcessPatientCreateRequest = {
  requestId: string;
  cxId: string;
  patientPayload: PatientPayload;
  bucket: string;
};

export type ProcessPatientDiscoveryRequest = {
  requestId: string;
  cxId: string;
  patientId: string;
  bucket: string;
};

export interface BulkUplaodHandler {
  processFile(request: ProcessFileRequest): Promise<void>;
  processPatientCreate(request: ProcessPatientCreateRequest): Promise<void>;
  processPatientDiscovery(request: ProcessPatientDiscoveryRequest): Promise<void>;
}
