export type ProcessPatientQueryRequest = {
  cxId: string;
  jobId: string;
  jobStartedAt: string;
  patientId: string;
  triggerConsolidated: boolean;
  disableWebhooks: boolean;
  rerunPdOnNewDemographics: boolean;
};

export interface PatientImportQueryHandler {
  processPatientQuery(request: ProcessPatientQueryRequest): Promise<void>;
}
