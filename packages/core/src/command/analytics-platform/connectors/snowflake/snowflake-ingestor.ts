export type SnowflakeIngestorRequest = {
  cxId: string;
};

export abstract class SnowflakeIngestor {
  abstract ingestCoreIntoSnowflake(request: SnowflakeIngestorRequest): Promise<void>;
}
