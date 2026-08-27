export const CONNECTOR_INGESTION_COMPLETE_EVENT_TYPE = "connector.ingestion.complete";

export type ConnectorIngestionCompleteMessage = {
  cxId: string;
  jobId: string;
  eventType: typeof CONNECTOR_INGESTION_COMPLETE_EVENT_TYPE;
  connector: string;
  timestamp: string;
};
