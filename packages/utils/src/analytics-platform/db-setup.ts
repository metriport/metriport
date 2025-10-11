/* eslint-disable @typescript-eslint/no-non-null-assertion */
import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { rawDbSchema } from "@metriport/core/command/analytics-platform/csv-to-db/db-asset-defs";
import {
  setupCustomerAnalyticsDb,
  UsersToCreateAndGrantAccess,
} from "@metriport/core/command/analytics-platform/csv-to-db/setup-cx-db";
import {
  dbCredsSchema,
  DbCredsWithSchema,
  getEnvVar,
  getEnvVarOrFail,
  sleep,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import readline from "readline/promises";
import { elapsedTimeAsStr } from "../shared/duration";

dayjs.extend(duration);

/**
 * Script to setup the analytics database for a customer.
 *
 * Set the username and password for the lambda user in the script.
 *
 * It relies on the following env vars:
 * - CX_ID
 * - ANALYTICS_DB_CREDS
 *
 * Run it with:
 * - ts-node src/analytics-platform/db-setup.ts -u <username>
 */

const cxIdFromEnvVars = getEnvVar("CX_ID");
const dbCredsRaw = getEnvVarOrFail("ANALYTICS_DB_CREDS");

const program = new Command();
program
  .name("db-setup")
  .description("CLI to setup the analytics database for a customer.")
  .option("-c, --cxId <cxId>", "The customer ID (optional, defaults to env var CX_ID)")
  .option("-f2c, --fhir-to-csv-username <username>", "The username for the lambda user")
  .option("-r2c, --raw-to-core-username <username>", "The username for the lambda user")
  .option("--users", "Create users", true)
  .option("--no-users", "Do not create users", false)
  .showHelpAfterError()
  .action(main);
program.parse();

async function main({
  cxId: cxIdParam,
  fhirToCsvUsername,
  rawToCoreUsername,
  users: createUsers,
}: {
  cxId: string | undefined;
  fhirToCsvUsername: string | undefined;
  rawToCoreUsername: string | undefined;
  users: boolean;
}) {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${buildDayjs().toISOString()} ##############`);

  const cxId = cxIdParam ?? cxIdFromEnvVars;
  if (!cxId) {
    console.log("Error: either --cxId or env var CX_ID is required");
    process.exit(1);
  }

  if (createUsers && (fhirToCsvUsername == undefined || rawToCoreUsername == undefined)) {
    console.log(
      "Error: either --no-users or --fhir-to-csv-username and --raw-to-core-username are required"
    );
    process.exit(1);
  }

  const dbCreds = dbCredsSchema.parse(JSON.parse(dbCredsRaw));
  const dbCredsWithSchema: DbCredsWithSchema = {
    ...dbCreds,
    schemaName: rawDbSchema,
  };

  let dbUsersToCreateAndGrantAccess: UsersToCreateAndGrantAccess | undefined = undefined;
  if (createUsers) {
    const f2cPwd = (await getPassword("fhir-to-csv")).trim();
    if (!f2cPwd) {
      console.log("Error: fhir-to-csv password is required");
      process.exit(1);
    }
    const r2cPwd = (await getPassword("raw-to-core")).trim();
    if (!r2cPwd) {
      console.log("Error: raw-to-core password is required");
      process.exit(1);
    }

    dbUsersToCreateAndGrantAccess = {
      f2c: { username: fhirToCsvUsername!, password: f2cPwd },
      r2c: { username: rawToCoreUsername!, password: r2cPwd },
    };
  }

  await setupCustomerAnalyticsDb({
    cxId,
    dbCreds: dbCredsWithSchema,
    dbUsersToCreateAndGrantAccess,
  });

  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

async function getPassword(username: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(`Type the password for the ${username} user: `);
  rl.close();
  return answer;
}

export default program;
