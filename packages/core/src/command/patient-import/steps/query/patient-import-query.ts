export type ProcessPatientQueryRequest = {
  /** Customer ID */
  cxId: string;
  /** Bulk import job ID, one for all patients in the bulk import job */
  jobId: string;
  /** Row number in CSV file */
  rowNumber: number;
  /** Patient ID */
  patientId: string;
  /**
   * The individual patient's data pipeline request ID, tracking patient discovery and
   * document query pipeline execution
   */
  dataPipelineRequestId: string;
  /** Whether to trigger the creation of the consolidated bundle */
  triggerConsolidated: boolean;
  /** Whether to disable webhooks */
  disableWebhooks: boolean;
  /** Whether to rerun patient discovery on new demographics */
  rerunPdOnNewDemographics?: boolean | undefined;
};

export interface PatientImportQuery {
  processPatientQuery(request: ProcessPatientQueryRequest): Promise<void>;
}
