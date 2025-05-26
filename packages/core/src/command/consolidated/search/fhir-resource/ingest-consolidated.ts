export type IngestConsolidatedParams = {
  cxId: string;
  patientId: string;
};
export type IngestMultipleConsolidatedParams = {
  cxId: string;
  patientIds: string[];
};

export type IngestConsolidatedResult = boolean;

export interface IngestConsolidated {
  ingestConsolidatedIntoSearchEngine(
    params: IngestConsolidatedParams
  ): Promise<IngestConsolidatedResult>;

  ingestConsolidatedIntoSearchEngine(
    params: IngestMultipleConsolidatedParams
  ): Promise<IngestConsolidatedResult>;
}
