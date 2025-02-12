import { PatientDemoData } from "../../../domain/patient";

export type PatientPayload = PatientDemoData & { externalId: string | undefined };

export type ProcessPatientCreateRequest = {
  cxId: string;
  facilityId: string;
  jobId: string;
  patientPayload: PatientPayload;
  triggerConsolidated: boolean;
  disableWebhooks: boolean;
  rerunPdOnNewDemographics: boolean;
};

export interface PatientImportCreateHandler {
  processPatientCreate(request: ProcessPatientCreateRequest): Promise<void>;
}
