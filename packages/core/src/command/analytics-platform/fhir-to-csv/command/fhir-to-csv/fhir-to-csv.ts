export type ProcessFhirToCsvRequest = {
  jobId: string;
  cxId: string;
  patientId: string;
  inputBundle?: string;
  timeoutInMillis?: number | undefined;
};

export interface FhirToCsvHandler {
  processFhirToCsv(request: ProcessFhirToCsvRequest): Promise<void>;
}
