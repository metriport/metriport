export type ProcessFhirToCsvRequest = {
  jobId: string;
  cxId: string;
  patientId: string;
  outputPrefix: string;
  timeoutInMillis?: number | undefined;
};

export interface FhirToCsvHandler {
  processFhirToCsv(request: ProcessFhirToCsvRequest): Promise<void>;
}
