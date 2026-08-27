// drop-snowflake-staging-db.ts
import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  promisifyConnect,
  promisifyDestroy,
  promisifyExecute,
} from "@metriport/core/external/snowflake/commands";
import { errorToString, getEnvVarOrFail } from "@metriport/shared";
import * as readline from "readline";
import * as snowflake from "snowflake-sdk";

/**
 * Script to drop a Snowflake staging database.
 *
 * This script will only work when:
 * - ENV_TYPE is set to "staging"
 * - Database name matches pattern: ANALYTICS_{THOMAS|LIAM}_{XX}_10CCE4AC
 *
 * Usage:
 * - set env vars on .env file:
 *   - SNOWFLAKE_ACCOUNT
 *   - SNOWFLAKE_TOKEN_SYSADMIN (token for SYSADMIN role)
 *   - SNOWFLAKE_DB
 *   - SNOWFLAKE_SCHEMA
 *   - SNOWFLAKE_WH
 *   - ENV_TYPE (must be "staging")
 *
 * Run it with:
 * - ts-node src/analytics-platform/snowflake/drop-snowflake-staging-db.ts
 */

const account = getEnvVarOrFail("SNOWFLAKE_ACCOUNT");
const tokenSysadmin = getEnvVarOrFail("SNOWFLAKE_TOKEN_SYSADMIN");
const database = getEnvVarOrFail("SNOWFLAKE_DB");
const schema = getEnvVarOrFail("SNOWFLAKE_SCHEMA");
const warehouse = getEnvVarOrFail("SNOWFLAKE_WH");
const envType = getEnvVarOrFail("ENV_TYPE");

snowflake.configure({
  ocspFailOpen: false,
  logLevel: "WARN",
  additionalLogToConsole: false,
});

function validateDatabaseName(dbName: string): boolean {
  // Pattern: ANALYTICS_{THOMAS|LIAM}_{XX}_10CCE4AC
  const pattern = /^ANALYTICS_(THOMAS|LIAM)_[A-Z0-9]{2}_10CCE4AC$/;
  return pattern.test(dbName);
}

function validateEnvType(env: string): boolean {
  return env.toLowerCase() === "staging";
}

function createConfirmationTable(): string {
  const table = [
    ["Setting", "Value"],
    ["Account", account],
    ["Database", database],
    ["Schema", schema],
    ["Warehouse", warehouse],
    ["Environment Type", envType.toUpperCase()],
  ];

  let output = "\n";
  const colWidths = [20, 60];

  // Header
  output += "┌" + "─".repeat(colWidths[0] + 2) + "┬" + "─".repeat(colWidths[1] + 2) + "┐\n";
  output +=
    "│ " + table[0][0].padEnd(colWidths[0]) + " │ " + table[0][1].padEnd(colWidths[1]) + " │\n";
  output += "├" + "─".repeat(colWidths[0] + 2) + "┼" + "─".repeat(colWidths[1] + 2) + "┤\n";

  // Rows
  for (let i = 1; i < table.length; i++) {
    output +=
      "│ " + table[i][0].padEnd(colWidths[0]) + " │ " + table[i][1].padEnd(colWidths[1]) + " │\n";
  }

  output += "└" + "─".repeat(colWidths[0] + 2) + "┴" + "─".repeat(colWidths[1] + 2) + "┘\n";

  return output;
}

function askDatabaseNameConfirmation(dbName: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question("Type the name of the database again to confirm deletion: ", answer => {
      rl.close();
      resolve(answer.trim() === dbName);
    });
  });
}

async function dropDatabase(): Promise<boolean> {
  const sysadminConnection = snowflake.createConnection({
    account,
    token: tokenSysadmin,
    database: "SNOWFLAKE", // Use default database for initial connection
    schema: "PUBLIC",
    warehouse,
    authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
    clientSessionKeepAlive: true,
  });

  try {
    console.log(">>> Connecting to Snowflake with SYSADMIN role...");
    const connectSysadminAsync = promisifyConnect(sysadminConnection);
    await connectSysadminAsync();
    console.log("Connected to Snowflake (SYSADMIN).");

    const executeSysadminAsync = promisifyExecute(sysadminConnection);

    console.log("\n>>> Executing database drop command...\n");

    // Ensure we're not using the target database before dropping
    try {
      console.log("[1/2] [SYSADMIN] Switching to default database");
      console.log("  Executing: USE DATABASE SNOWFLAKE;");
      await executeSysadminAsync("USE DATABASE SNOWFLAKE;");
    } catch (error) {
      // Ignore errors when switching context
      console.log("  ⚠️  Could not switch to default database, continuing...");
    }

    // Drop the database
    try {
      console.log("[2/2] [SYSADMIN] Dropping database");
      const dropCommand = `DROP DATABASE "${database}";`;
      console.log(`  Executing: ${dropCommand}`);
      await executeSysadminAsync(dropCommand);
      console.log("\n✅ Database dropped successfully!");
      return true;
    } catch (error) {
      const errorStr = errorToString(error);
      if (errorStr.includes("does not exist") || errorStr.includes("not found")) {
        console.log("\n⚠️  Database does not exist or has already been dropped.");
        return true; // Consider this a success since the goal is achieved
      }
      console.error(`\n❌ Failed to drop database: ${database}`);
      console.error(`   Error: ${errorStr}`);
      return false;
    }
  } catch (error) {
    console.error("\n❌ Unexpected error:", errorToString(error));
    return false;
  } finally {
    try {
      const destroySysadminAsync = promisifyDestroy(sysadminConnection);
      await destroySysadminAsync();
    } catch (error) {
      console.error("Error destroying SYSADMIN connection: ", errorToString(error));
    }
  }
}

async function main() {
  // Validate environment type
  if (!validateEnvType(envType)) {
    console.error(
      `❌ Error: ENV_TYPE must be "staging" to use this script. Current value: "${envType}"`
    );
    console.error("   This script is only allowed to run in staging environments.");
    process.exit(1);
  }

  // Validate database name pattern
  if (!validateDatabaseName(database)) {
    console.error(`❌ Error: Database name does not match required pattern for staging deletion.`);
    console.error(`   Current database: "${database}"`);
    console.error(`   Required pattern: ANALYTICS_{THOMAS|LIAM}_{XX}_10CCE4AC`);
    console.error("   Example: ANALYTICS_THOMAS_09_10CCE4AC or ANALYTICS_LIAM_01_10CCE4AC");
    process.exit(1);
  }

  console.log(createConfirmationTable());
  console.log(`\n⚠️  WARNING: This will PERMANENTLY DELETE database: ${database}`);
  console.log("   All data, tables, schemas, and objects in this database will be lost.");
  console.log("   This action cannot be undone.\n");

  const confirmed = await askDatabaseNameConfirmation(database);

  if (!confirmed) {
    console.log("\n❌ Confirmation failed. Database name did not match.");
    console.log("   Operation cancelled.");
    process.exit(0);
  }

  const success = await dropDatabase();
  process.exit(success ? 0 : 1);
}

main();
