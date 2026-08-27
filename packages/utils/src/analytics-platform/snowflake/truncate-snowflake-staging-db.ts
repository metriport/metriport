// truncate-snowflake-staging-db.ts
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
 * Script to drop all tables in a specified schema (defaults to PUBLIC) of a Snowflake staging database.
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
 *   - SCHEMA (optional, defaults to PUBLIC if not set)
 *   - SNOWFLAKE_SCHEMA (optional, fallback if SCHEMA not set, defaults to PUBLIC)
 *   - SNOWFLAKE_WH
 *   - ENV_TYPE (must be "staging")
 *
 * Run it with:
 * - SCHEMA=CORE ts-node src/analytics-platform/snowflake/truncate-snowflake-staging-db.ts
 * - ts-node src/analytics-platform/snowflake/truncate-snowflake-staging-db.ts (uses PUBLIC)
 */

const account = getEnvVarOrFail("SNOWFLAKE_ACCOUNT");
const tokenSysadmin = getEnvVarOrFail("SNOWFLAKE_TOKEN_SYSADMIN");
const database = getEnvVarOrFail("SNOWFLAKE_DB");
const schema = process.env.SCHEMA || process.env.SNOWFLAKE_SCHEMA || "PUBLIC";
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

function createConfirmationTable(tableNames: string[]): string {
  const table = [
    ["Setting", "Value"],
    ["Account", account],
    ["Database", database],
    ["Schema", schema],
    ["Warehouse", warehouse],
    ["Environment Type", envType.toUpperCase()],
    ["Tables to Drop", `${tableNames.length} table(s)`],
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

function askDatabaseNameConfirmation(dbName: string, schemaName: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const expectedAnswer = `${dbName}.${schemaName}`;

  return new Promise(resolve => {
    rl.question(
      `Type the database and schema name (format: DATABASE.SCHEMA) to confirm deletion: `,
      answer => {
        rl.close();
        resolve(answer.trim() === expectedAnswer);
      }
    );
  });
}

async function getTablesInSchema(
  executeAsync: (sqlText: string) => Promise<{
    statement: snowflake.RowStatement;
    rows: any[] | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  }>,
  targetSchema: string
): Promise<string[]> {
  try {
    const showTablesCommand = `SHOW TABLES IN SCHEMA "${database}"."${targetSchema}";`;
    const { rows } = await executeAsync(showTablesCommand);

    if (!rows || rows.length === 0) {
      return [];
    }

    // Extract table names from the result
    // SHOW TABLES returns rows with a 'name' column
    return rows.map((row: any) => row.name as string).filter(Boolean); // eslint-disable-line @typescript-eslint/no-explicit-any
  } catch (error) {
    const errorStr = errorToString(error);
    if (errorStr.includes("does not exist") || errorStr.includes("not found")) {
      console.log("  ⚠️  Schema or database does not exist.");
      return [];
    }
    throw error;
  }
}

async function truncateDatabase(): Promise<boolean> {
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

    // Switch to target database
    try {
      console.log("\n>>> Switching to target database...");
      await executeSysadminAsync(`USE DATABASE "${database}";`);
      await executeSysadminAsync(`USE SCHEMA "${schema}";`);
      console.log(`Using database: ${database}, schema: ${schema}`);
    } catch (error) {
      const errorStr = errorToString(error);
      if (errorStr.includes("does not exist") || errorStr.includes("not found")) {
        console.log("\n⚠️  Database or schema does not exist.");
        return true; // Consider this a success since there's nothing to drop
      }
      throw error;
    }

    // Get all tables in target schema
    console.log(`\n>>> Listing tables in ${schema} schema...\n`);
    const tableNames = await getTablesInSchema(executeSysadminAsync, schema);

    if (tableNames.length === 0) {
      console.log(`✅ No tables found in ${schema} schema. Nothing to drop.`);
      return true;
    }

    console.log(`Found ${tableNames.length} table(s) in ${schema} schema:`);
    tableNames.forEach((name, index) => {
      console.log(`  ${index + 1}. ${name}`);
    });

    console.log("\n>>> Dropping all tables...\n");

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < tableNames.length; i++) {
      const tableName = tableNames[i];
      try {
        console.log(`[${i + 1}/${tableNames.length}] [SYSADMIN] Dropping table: ${tableName}`);
        const dropCommand = `DROP TABLE IF EXISTS "${database}"."${schema}"."${tableName}";`;
        console.log(`  Executing: ${dropCommand}`);
        await executeSysadminAsync(dropCommand);
        successCount++;
      } catch (error) {
        errorCount++;
        const errorStr = errorToString(error);
        console.error(`  ❌ Failed to drop table ${tableName}: ${errorStr}`);
        // Continue with other tables even if one fails
      }
    }

    console.log("\n>>> Summary:");
    console.log(`  ✅ Successfully dropped: ${successCount} table(s)`);
    if (errorCount > 0) {
      console.log(`  ❌ Failed to drop: ${errorCount} table(s)`);
    }

    // Create PATIENT_MAPPING table if it doesn't exist
    console.log("\n>>> Creating PATIENT_MAPPING table...\n");
    try {
      console.log("[SYSADMIN] Creating PATIENT_MAPPING table");
      const createTableCommand =
        "CREATE TABLE IF NOT EXISTS PATIENT_MAPPING (id varchar, external_id varchar);";
      console.log(`  Executing: ${createTableCommand}`);
      await executeSysadminAsync(createTableCommand);
      console.log("  ✅ PATIENT_MAPPING table created or already exists.");
    } catch (error) {
      const errorStr = errorToString(error);
      console.error(`  ❌ Failed to create PATIENT_MAPPING table: ${errorStr}`);
      // Don't fail the whole operation if table creation fails
    }

    if (errorCount === 0) {
      console.log("\n✅ All tables dropped successfully!");
      return true;
    } else {
      console.log(`\n⚠️  Completed with ${errorCount} error(s).`);
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

  // Connect to get table list for confirmation
  const tempConnection = snowflake.createConnection({
    account,
    token: tokenSysadmin,
    database: "SNOWFLAKE",
    schema: "PUBLIC",
    warehouse,
    authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
    clientSessionKeepAlive: true,
  });

  let tableNames: string[] = [];

  try {
    const connectAsync = promisifyConnect(tempConnection);
    await connectAsync();
    const executeAsync = promisifyExecute(tempConnection);

    // Switch to target database to get table list
    try {
      await executeAsync(`USE DATABASE "${database}";`);
      await executeAsync(`USE SCHEMA "${schema}";`);
      tableNames = await getTablesInSchema(executeAsync, schema);
    } catch (error) {
      // If database doesn't exist, that's okay - we'll handle it in truncateDatabase
      const errorStr = errorToString(error);
      if (!errorStr.includes("does not exist") && !errorStr.includes("not found")) {
        throw error;
      }
    }
  } catch (error) {
    console.error("Error connecting to get table list:", errorToString(error));
    // Continue anyway - truncateDatabase will handle it
  } finally {
    try {
      const destroyAsync = promisifyDestroy(tempConnection);
      await destroyAsync();
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  console.log(createConfirmationTable(tableNames));
  console.log(
    `\n⚠️  WARNING: This will PERMANENTLY DELETE all tables in ${schema} schema of: ${database}`
  );
  console.log("   All data in these tables will be lost.");
  console.log("   This action cannot be undone.\n");

  if (tableNames.length > 0) {
    console.log("Tables that will be dropped:");
    tableNames.forEach((name, index) => {
      console.log(`  ${index + 1}. ${name}`);
    });
    console.log("");
  }

  const confirmed = await askDatabaseNameConfirmation(database, schema);

  if (!confirmed) {
    console.log("\n❌ Confirmation failed. Database and schema name did not match.");
    console.log(`   Expected: ${database}.${schema}`);
    console.log("   Operation cancelled.");
    process.exit(0);
  }

  const success = await truncateDatabase();
  process.exit(success ? 0 : 1);
}

main();
