import { Config } from "../../../../util/config";
import { SnowflakeIngestor } from "./snowflake-ingestor";
import { SnowflakeIngestorCloud } from "./snowflake-ingestor-cloud";
import { SnowflakeIngestorLocal } from "./snowflake-ingestor-local";

export function buildSnowflakeIngestor(): SnowflakeIngestor {
  if (Config.isDev()) {
    return new SnowflakeIngestorLocal(
      Config.getAnalyticsBucketName(),
      Config.getAWSRegion(),
      Config.getSnowflakeCredsForAllRegions(),
      Config.getSnowflakeSettingsForAllCustomers()
    );
  }
  return new SnowflakeIngestorCloud();
}
