import { MetriportError } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { SnowflakeIngestorDirect } from "./snowflake-ingestor-direct";

export async function ingestCoreIntoSnowflakeBatchCommand(): Promise<void> {
  const cxId = process.argv[2];
  const coreExportJobId = process.argv[3];
  const jobId = process.argv[4];

  if (!cxId || !coreExportJobId || !jobId) {
    throw new MetriportError(
      "Usage: node run-snowflake-ingest.js <cxId> <coreExportJobId> <jobId>"
    );
  }

  const analyticsBucketName = Config.getAnalyticsBucketName();
  const region = Config.getAWSRegion();
  const snowflakeCredsForAllRegions = Config.getSnowflakeCredsForAllRegions();
  const snowflakeSettingsForAllCustomers = Config.getSnowflakeSettingsForAllCustomers();
  const connectorIngestionCompleteTopicArn = Config.getConnectorIngestionCompleteTopicArn();

  const handler = new SnowflakeIngestorDirect(
    snowflakeCredsForAllRegions,
    snowflakeSettingsForAllCustomers,
    analyticsBucketName,
    region,
    connectorIngestionCompleteTopicArn
  );
  await handler.ingestCoreIntoSnowflakeSync({ cxId, jobId, coreExportJobId });
}
