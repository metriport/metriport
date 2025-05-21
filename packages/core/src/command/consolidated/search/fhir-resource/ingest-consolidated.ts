export type IngestConsolidatedParams = {
  cxId: string;
  patientId: string;
};

export type IngestConsolidatedResult = boolean;

export interface IngestConsolidated {
  ingestIntoSearchEngine(params: IngestConsolidatedParams): Promise<IngestConsolidatedResult>;
}
