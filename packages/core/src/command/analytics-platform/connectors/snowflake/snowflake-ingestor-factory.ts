import { Config } from "../../../../util/config";
import { SnowflakeIngestor } from "./snowflake-ingestor";
import { SnowflakeIngestorCloud } from "./snowflake-ingestor-cloud";
import { SnowflakeIngestorDirect } from "./snowflake-ingestor-direct";

export function buildSnowflakeIngestor(): SnowflakeIngestor {
  if (Config.isDev()) {
    return new SnowflakeIngestorDirect();
  }
  return new SnowflakeIngestorCloud();
}
