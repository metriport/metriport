import { PatientDemoData } from "../../domain/patient";

export type JobStatus = "waiting" | "processing" | "completed" | "failed";

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
  cxId: string;
  facilityId: string;
  jobStartedAt: string;
  dryRun: boolean;
  status: JobStatus;
};

export type PatientPayload = PatientDemoData & { externalId: string | undefined };

export type JobResponseBase = {
  jobId: string;
  status: JobStatus;
};

export type JobResponseCreate = JobResponseBase & {
  uploadUrl: string;
};
