import { PatientDemoData } from "../../domain/patient";
import { PatientImportStatus } from "../../domain/patient/patient-import";

export type PatientRecordStatus = "processing" | "successful" | "failed";

export type PatientRecord = {
  patientId: string;
  status: PatientRecordStatus;
};

export type PatientRecordUpdate = Omit<PatientRecord, "patientId">;

export type JobRecord = {
  cxId: string;
  facilityId: string;
  jobStartedAt: string;
  dryRun: boolean;
  status: PatientImportStatus;
};

export type PatientPayload = PatientDemoData & { externalId: string | undefined };
