import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { exportCoreToS3 } from "@metriport/core/command/analytics-platform/core-transform/core-to-s3";
import { coreSchemaName } from "@metriport/core/domain/analytics/core-schema";
import { dbCredsSchema, DbCredsWithSchema, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { elapsedTimeAsStr } from "../shared/duration";

dayjs.extend(duration);

/**
 * Script to export core analytics data from Postgres to S3 for a customer.
 *
 * Relies on the following env vars:
 * - ANALYTICS_DB_CREDS
 * - ANALYTICS_BUCKET_NAME
 * - REGION
 *
 * Usage:
 *   ts-node src/analytics-platform/export-core-to-s3.ts --cxId <customer-id>
 */

const dbCredsRaw = getEnvVarOrFail("ANALYTICS_DB_CREDS");
const analyticsBucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");

const program = new Command();
program
  .name("export-core-to-s3")
  .description("CLI to export the core data to S3 for a customer.")
  .requiredOption("-u, --cxId <cxId>", "The CX ID")
  .showHelpAfterError()
  .action(main);
program.parse();

async function main({ cxId }: { cxId: string }) {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${buildDayjs().toISOString()} ##############`);

  const dbCreds = dbCredsSchema.parse(JSON.parse(dbCredsRaw));
  const dbCredsWithSchema: DbCredsWithSchema = {
    ...dbCreds,
    schemaName: coreSchemaName,
  };

  await exportCoreToS3({ cxId, dbCreds: dbCredsWithSchema, analyticsBucketName, region });

  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
  process.exit(0);
}

export default program;
