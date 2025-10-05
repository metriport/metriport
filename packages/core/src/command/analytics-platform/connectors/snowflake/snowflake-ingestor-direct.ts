import { CustomSnowflakeSettings, SnowflakeCreds } from "../../../../external/snowflake/creds";
import { processAsyncError } from "../../../../util/error/shared";
import { out } from "../../../../util/log";
import { ingestCoreIntoSnowflake } from "./ingest-core-into-snowflake";
import { SnowflakeIngestor, SnowflakeIngestorRequest } from "./snowflake-ingestor";

/**
 * Direct implementation of the SnowflakeIngestor.
 *
 * NOTE: This is used in the development environment ONLY to trigger the ingestion of core data into Snowflake.
 */
export class SnowflakeIngestorDirect extends SnowflakeIngestor {
  constructor(
    private readonly analyticsBucketName: string,
    private readonly region: string,
    private readonly snowflakeCreds: SnowflakeCreds,
    private readonly snowflakeCustomCxSettings: CustomSnowflakeSettings
  ) {
    super();
  }

  async ingestCoreIntoSnowflake({ cxId }: SnowflakeIngestorRequest): Promise<void> {
    const { log } = out(`SnowflakeIngestorDirect - cx ${cxId}`);

    // intentionally async to replicate the behavior of the cloud implementation, where we send a
    // message to SQS and let the lambda handle the ingestion
    ingestCoreIntoSnowflake({
      cxId,
      bucketName: this.analyticsBucketName,
      region: this.region,
      snowflakeCreds: this.snowflakeCreds,
      snowflakeCustomCxSettings: this.snowflakeCustomCxSettings,
    }).catch(processAsyncError("Error triggering ingestion of core data into Snowflake"));

    log(`Triggered ingestion of core data into Snowflake`);
  }
}
