import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ingestCoreIntoSnowflake } from "@metriport/core/command/analytics-platform/connectors/snowflake/ingest-core-into-snowflake";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { elapsedTimeAsStr } from "../../shared/duration";

dayjs.extend(duration);

/**
 * Script to manually ingest the core data from S3 into Snowflake.
 *
 * Note: this is used FOR DEVELOPMENT PURPOSES ONLY.
 *
 * Relies on the following env vars:
 * - ANALYTICS_BUCKET_NAME
 * - AWS_REGION
 * - FEATURE_FLAGS_TABLE_NAME
 * - SNOWFLAKE_ACCOUNT
 * - SNOWFLAKE_TOKEN
 * - SNOWFLAKE_WH
 * - SNOWFLAKE_DB
 *
 * Usage:
 *   ts-node src/analytics-platform/snowflake/ingest-core-into-snowflake.ts -c <cxId>
 */

const analyticsBucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const featureFlagsTableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");
const snowflakeAccount = getEnvVarOrFail("SNOWFLAKE_ACCOUNT");
const snowflakeToken = getEnvVarOrFail("SNOWFLAKE_TOKEN");
const snowflakeWarehouse = getEnvVarOrFail("SNOWFLAKE_WH");
const snowflakeDatabase = getEnvVarOrFail("SNOWFLAKE_DB");

const program = new Command();
program
  .name("ingest-core-into-snowflake")
  .description("CLI to ingest the core data into Snowflake.")
  .requiredOption("-c, --cxId <cxId>", "The CX ID")
  .showHelpAfterError()
  .action(main);
program.parse();

FeatureFlags.init(region, featureFlagsTableName);

async function main({ cxId }: { cxId: string }) {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${buildDayjs().toISOString()} ##############`);

  const snowflakeCredsForAllRegions = {
    "us-east-2": {
      account: snowflakeAccount,
      apiToken: snowflakeToken,
      warehouseName: snowflakeWarehouse,
    },
  };
  const snowflakeSettingsForAllCxs = {
    [cxId]: {
      region: "us-east-2" as const,
      dbName: snowflakeDatabase,
      dbSchema: "public",
    },
  };

  await ingestCoreIntoSnowflake({
    cxId,
    region,
    bucketName: analyticsBucketName,
    snowflakeCredsForAllRegions,
    snowflakeSettingsForAllCxs,
  });

  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

export default program;
