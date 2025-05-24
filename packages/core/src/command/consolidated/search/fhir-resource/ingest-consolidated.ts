export type IngestConsolidatedParams = {
  cxId: string;
  patientId: string;
};

export type IngestConsolidatedResult = boolean;

export interface IngestConsolidated {
  ingest(params: IngestConsolidatedParams): Promise<IngestConsolidatedResult>;
}
