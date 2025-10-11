import { SnowflakeCreds, SnowflakeSettingsForAllCxs } from "../../../../external/snowflake/creds";
import { processAsyncError } from "../../../../util/error/shared";
import { out } from "../../../../util/log";
import { ingestCoreIntoSnowflake } from "./ingest-core-into-snowflake";
import { SnowflakeIngestor, SnowflakeIngestorRequest } from "./snowflake-ingestor";

/**
 * Local implementation of the SnowflakeIngestor.
 *
 * NOTE: This is used in the development environment ONLY to trigger the ingestion of core data into Snowflake.
 * The lambda invokes the `ingestCoreIntoSnowflake` command directly, not through this class.
 */
export class SnowflakeIngestorLocal extends SnowflakeIngestor {
  constructor(
    private readonly analyticsBucketName: string,
    private readonly region: string,
    private readonly snowflakeCredsForAllRegions: SnowflakeCreds,
    private readonly snowflakeSettingsForAllCxs: SnowflakeSettingsForAllCxs
  ) {
    super();
  }

  /**
   * Copies files from local (output from PG export) to S3 and then ingests them into Snowflake.
   */
  async ingestCoreIntoSnowflake({
    cxId,
    forceSynchronous: forceSync,
  }: SnowflakeIngestorRequest): Promise<void> {
    const { log } = out(`SnowflakeIngestorLocal - cx ${cxId}`);

    // intentionally async to replicate the behavior of the cloud implementation, where we send a
    // message to SQS and let the lambda handle the ingestion
    const promise = ingestCoreIntoSnowflake({
      cxId,
      bucketName: this.analyticsBucketName,
      region: this.region,
      snowflakeCredsForAllRegions: this.snowflakeCredsForAllRegions,
      snowflakeSettingsForAllCxs: this.snowflakeSettingsForAllCxs,
    }).catch(processAsyncError("Error triggering ingestion of core data into Snowflake"));

    if (forceSync) await promise;

    log(`Triggered ingestion of core data into Snowflake`);
  }
}
