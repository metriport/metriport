export type ProcessFhirToCsvBulkRequest = {
  cxId: string;
  patientIds: string[];
  outputPrefix: string;
  timeoutInMillis?: number | undefined;
  progressCallback?: (current: number, total: number) => void;
};

export interface FhirToCsvBulkHandler {
  /**
   * Triggers the conversion of consolidated/FHIR to CSV in bulk.
   *
   * @param params - The request object.
   * @returns The IDs of the patients that failed to convert (see implementations for details).
   */
  processFhirToCsvBulk(request: ProcessFhirToCsvBulkRequest): Promise<string[]>;
}
