import { PatientDemoData } from "../../../../domain/patient";

export type PatientPayload = PatientDemoData & { externalId: string | undefined };

export type ProcessPatientCreateRequest = {
  cxId: string;
  facilityId: string;
  jobId: string;
  rowNumber: number;
  triggerConsolidated: boolean;
  disableWebhooks: boolean;
  rerunPdOnNewDemographics?: boolean | undefined;
};

export interface PatientImportCreate {
  processPatientCreate(request: ProcessPatientCreateRequest): Promise<void>;
}
