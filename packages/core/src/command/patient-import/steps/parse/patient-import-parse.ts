export type StartPatientImportRequest = {
  cxId: string;
  jobId: string;
  triggerConsolidated?: boolean;
  disableWebhooks?: boolean;
  rerunPdOnNewDemographics?: boolean;
  dryRun?: boolean | undefined;
};

export interface PatientImportParseHandler {
  processJobParse(request: StartPatientImportRequest): Promise<void>;
}
