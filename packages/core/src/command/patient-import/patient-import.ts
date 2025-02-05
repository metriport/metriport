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

export type PatientPayload = PatientDemoData & { externalId: string | undefined };

export {};
