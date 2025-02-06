export type StartPatientImportRequest = {
  cxId: string;
  facilityId: string;
  jobId: string;
  triggerConsolidated?: boolean;
  disableWebhooks?: boolean;
  rerunPdOnNewDemographics?: boolean;
  dryRun?: boolean;
};

export interface PatientImportParseHandler {
  startPatientImport(request: StartPatientImportRequest): Promise<void>;
}
