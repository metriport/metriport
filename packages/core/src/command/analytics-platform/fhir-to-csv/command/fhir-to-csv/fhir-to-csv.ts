export type ProcessFhirToCsvRequest = {
  jobId: string;
  cxId: string;
  patientId: string;
  inputBundle?: string;
};

export interface FhirToCsvHandler {
  processFhirToCsv(request: ProcessFhirToCsvRequest): Promise<void>;
}
