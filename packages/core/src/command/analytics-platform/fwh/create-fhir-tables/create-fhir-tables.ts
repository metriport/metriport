export type CreateFhirTablesRequest = {
  cxId: string;
  /**
   * How long can it wait for the response from the transform lambda before it fails.
   * Important so we are able to fail the processing in a lambda before the lambda's process
   * gets killed - and then we don't handle the error.
   */
  timeoutInMillis?: number | undefined;
};

export interface CreateFhirTablesHandler {
  createFhirTables(request: CreateFhirTablesRequest): Promise<void>;
}
