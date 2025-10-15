export type ProcessFhirToCsvBulkRequest = {
  cxId: string;
  patientIds: string[];
  outputPrefix: string;
  timeoutInMillis?: number | undefined;
};

export interface FhirToCsvBulkHandler {
  processFhirToCsvBulk(request: ProcessFhirToCsvBulkRequest): Promise<string[]>;
}
