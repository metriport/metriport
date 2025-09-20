export type ProcessFhirToCsvBulkRequest = {
  jobId: string;
  cxId: string;
  patientId: string;
  outputPrefix: string;
  timeoutInMillis?: number | undefined;
};

export interface FhirToCsvBulkHandler {
  processFhirToCsvBulk(request: ProcessFhirToCsvBulkRequest): Promise<void>;
}
