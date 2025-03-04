export type PatientImportParseRequest = {
  cxId: string;
  jobId: string;
  triggerConsolidated?: boolean;
  disableWebhooks?: boolean;
  rerunPdOnNewDemographics?: boolean;
  dryRun?: boolean | undefined;
  forceStatusUpdate?: boolean | undefined;
};

export interface PatientImportParse {
  processJobParse(request: PatientImportParseRequest): Promise<void>;
}
