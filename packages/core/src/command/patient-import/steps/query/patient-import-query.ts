export type ProcessPatientQueryRequest = {
  cxId: string;
  jobId: string;
  rowNumber: number;
  patientId: string;
  triggerConsolidated: boolean;
  disableWebhooks: boolean;
  rerunPdOnNewDemographics?: boolean | undefined;
};

export interface PatientImportQuery {
  processPatientQuery(request: ProcessPatientQueryRequest): Promise<void>;
}
