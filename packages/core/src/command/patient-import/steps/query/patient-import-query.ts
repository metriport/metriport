export type ProcessPatientQueryRequest = {
  cxId: string;
  jobId: string;
  patientId: string;
  triggerConsolidated: boolean;
  disableWebhooks: boolean;
  rerunPdOnNewDemographics?: boolean | undefined;
};

export interface PatientImportQueryHandler {
  processPatientQuery(request: ProcessPatientQueryRequest): Promise<void>;
}
