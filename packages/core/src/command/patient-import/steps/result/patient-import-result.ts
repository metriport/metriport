export type ProcessPatientResult = {
  cxId: string;
  jobId: string;
};

export interface PatientImportResult {
  processJobResult(request: ProcessPatientResult): Promise<void>;
}
