import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { exportCoreToExternalDatawarehouses } from "@metriport/core/command/analytics-platform/core-transform/core-to-dwh";
import { dbCredsSchema, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { elapsedTimeAsStr } from "../shared/duration";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";

dayjs.extend(duration);

/**
 * Script to export core analytics data from Postgres to external data warehouses for a customer.
 *
 * Relies on the following env vars:
 * - ANALYTICS_DB_CREDS
 * - ANALYTICS_BUCKET_NAME
 * - REGION
 *
 * Usage:
 *   ts-node src/analytics-platform/export-core-to-dwh.ts --cxId <customer-id>
 */

const dbCredsRaw = getEnvVarOrFail("ANALYTICS_DB_CREDS");
const analyticsBucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const featureFlagsTableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");

const program = new Command();
program
  .name("export-core-to-dwh")
  .description("CLI to export the core data to external data warehouses for a customer.")
  .requiredOption("-c, --cxId <cxId>", "The CX ID")
  .option(
    "-s, --schema-name <schema-name>",
    "The name of the DB schema to use, if not provided it will use the default one"
  )
  .showHelpAfterError()
  .action(main);
program.parse();

FeatureFlags.init(region, featureFlagsTableName);

async function main({ cxId, schemaName }: { cxId: string; schemaName: string | undefined }) {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${buildDayjs().toISOString()} ##############`);

  const dbCreds = dbCredsSchema.parse(JSON.parse(dbCredsRaw));

  await exportCoreToExternalDatawarehouses({
    cxId,
    dbCreds,
    schemaName,
    analyticsBucketName,
    region,
  });

  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

export default program;
