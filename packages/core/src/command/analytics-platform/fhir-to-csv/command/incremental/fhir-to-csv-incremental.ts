export type ProcessFhirToCsvIncrementalRequest = {
  cxId: string;
  patientId: string;
  /** Represents the call to processFhirToCsvIncremental. If not provided, a jobId will be generated. */
  jobId?: string;
  timeoutInMillis?: number | undefined;
};

export interface FhirToCsvIncrementalHandler {
  processFhirToCsvIncremental(request: ProcessFhirToCsvIncrementalRequest): Promise<void>;
}
