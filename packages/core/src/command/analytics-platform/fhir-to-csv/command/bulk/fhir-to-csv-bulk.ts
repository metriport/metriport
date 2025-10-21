export type ProcessFhirToCsvBulkRequest = {
  cxId: string;
  patientIds: string[];
  outputPrefix: string;
  timeoutInMillis?: number | undefined;
};

export interface FhirToCsvBulkHandler {
  /**
   * Triggers the conversion of consolidated/FHIR to CSV in bulk.
   *
   * @param request - The request object.
   * @returns The IDs of the patients that failed to convert (see implementations for details).
   */
  processFhirToCsvBulk(request: ProcessFhirToCsvBulkRequest): Promise<string[]>;
}
