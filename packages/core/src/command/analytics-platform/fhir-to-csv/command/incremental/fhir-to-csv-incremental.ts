export type ProcessFhirToCsvIncrementalRequest = {
  cxId: string;
  patientId: string;
  timeoutInMillis?: number | undefined;
};

export interface FhirToCsvIncrementalHandler {
  processFhirToCsvIncremental(request: ProcessFhirToCsvIncrementalRequest): Promise<void>;
}
