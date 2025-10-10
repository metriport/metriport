export type SnowflakeIngestorRequest = {
  cxId: string;
  forceSynchronous?: boolean;
};

export abstract class SnowflakeIngestor {
  abstract ingestCoreIntoSnowflake(request: SnowflakeIngestorRequest): Promise<void>;
}
