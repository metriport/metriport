import { generateJobId } from "../../utils";

export type SnowflakeIngestorRequest = {
  cxId: string;
  coreExportJobId: string;
  jobId?: string;
};

export abstract class SnowflakeIngestor {
  abstract ingestCoreIntoSnowflake(request: SnowflakeIngestorRequest): Promise<string>;

  generateJobId(): string {
    return generateJobId();
  }
}
