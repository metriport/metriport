// create-snowflake-db.ts
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
 * Script to create a Snowflake database with proper permissions and file formats.
 *
 * Usage:
 * - set env vars on .env file:
 *   - SNOWFLAKE_ACCOUNT
 *   - SNOWFLAKE_TOKEN_SYSADMIN (token for SYSADMIN role)
 *   - SNOWFLAKE_TOKEN_SECURITYADMIN (token for SECURITYADMIN role)
 *   - SNOWFLAKE_DB
 *   - SNOWFLAKE_SCHEMA
 *   - SNOWFLAKE_WH
 *
 * Run it with:
 * - ts-node src/analytics-platform/snowflake/create-snowflake-db.ts
 */

const account = getEnvVarOrFail("SNOWFLAKE_ACCOUNT");
const tokenSysadmin = getEnvVarOrFail("SNOWFLAKE_TOKEN_SYSADMIN");
const tokenSecurityadmin = getEnvVarOrFail("SNOWFLAKE_TOKEN_SECURITYADMIN");
const database = getEnvVarOrFail("SNOWFLAKE_DB");
const schema = getEnvVarOrFail("SNOWFLAKE_SCHEMA");
const warehouse = getEnvVarOrFail("SNOWFLAKE_WH");
const envType = getEnvVarOrFail("ENV_TYPE");

snowflake.configure({
  ocspFailOpen: false,
  logLevel: "WARN",
  additionalLogToConsole: false,
});

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

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

type Operation = {
  description: string;
  command: string;
  rollback?: string;
  skipIfExists?: boolean;
  role: "SYSADMIN" | "SECURITYADMIN";
};

async function createDatabase(): Promise<boolean> {
  // Create connections for both roles
  const sysadminConnection = snowflake.createConnection({
    account,
    token: tokenSysadmin,
    database: "SNOWFLAKE", // Use default database for initial connection
    schema: "PUBLIC",
    warehouse,
    authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
    clientSessionKeepAlive: true,
  });

  const securityadminConnection = snowflake.createConnection({
    account,
    token: tokenSecurityadmin,
    database: "SNOWFLAKE",
    schema: "PUBLIC",
    warehouse,
    authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
    clientSessionKeepAlive: true,
  });

  const executedOperations: Operation[] = [];

  try {
    console.log(">>> Connecting to Snowflake with SYSADMIN role...");
    const connectSysadminAsync = promisifyConnect(sysadminConnection);
    await connectSysadminAsync();
    console.log("Connected to Snowflake (SYSADMIN).");

    console.log(">>> Connecting to Snowflake with SECURITYADMIN role...");
    const connectSecurityadminAsync = promisifyConnect(securityadminConnection);
    await connectSecurityadminAsync();
    console.log("Connected to Snowflake (SECURITYADMIN).");

    const executeSysadminAsync = promisifyExecute(sysadminConnection);
    const executeSecurityadminAsync = promisifyExecute(securityadminConnection);

    console.log("\n>>> Executing database creation commands...\n");

    // Group operations by role - all SYSADMIN operations first, then SECURITYADMIN
    const sysadminOperations: Operation[] = [
      {
        description: "Set database name variable",
        command: `SET DB_NAME = '${database}';`,
        role: "SYSADMIN",
      },
      {
        description: "Create database",
        command: "CREATE DATABASE IDENTIFIER($DB_NAME);",
        rollback: `DROP DATABASE "${database}";`,
        skipIfExists: true,
        role: "SYSADMIN",
      },
      {
        description: "Use database",
        command: `USE IDENTIFIER($DB_NAME);`,
        role: "SYSADMIN",
      },
      {
        description: "Grant usage to SYSADMIN",
        command: `GRANT USAGE ON DATABASE IDENTIFIER($DB_NAME) TO ROLE SYSADMIN;`,
        role: "SYSADMIN",
      },
      {
        description: "Grant ownership of database to SYSADMIN",
        command: `GRANT OWNERSHIP ON DATABASE IDENTIFIER($DB_NAME) TO ROLE SYSADMIN;`,
        role: "SYSADMIN",
      },
      {
        description: "Grant ownership of PUBLIC schema to SYSADMIN",
        command: `GRANT OWNERSHIP ON SCHEMA PUBLIC TO ROLE SYSADMIN;`,
        role: "SYSADMIN",
      },
      {
        description: "Create gzip_csv_format file format",
        command: `CREATE FILE FORMAT gzip_csv_format TYPE = CSV FIELD_DELIMITER = ',', ESCAPE = '\\\\', FIELD_OPTIONALLY_ENCLOSED_BY = '"' COMPRESSION = GZIP;`,
        rollback: "DROP FILE FORMAT gzip_csv_format;",
        skipIfExists: true,
        role: "SYSADMIN",
      },
    ];

    const securityadminOperations: Operation[] = [
      {
        description: "Grant usage to DEV_RO",
        command: `GRANT USAGE ON DATABASE "${database}" TO ROLE DEV_RO;`,
        role: "SECURITYADMIN",
      },
      {
        description: "Grant usage on all schemas to DEV_RO",
        command: `GRANT USAGE ON ALL SCHEMAS IN DATABASE "${database}" TO ROLE DEV_RO;`,
        role: "SECURITYADMIN",
      },
      {
        description: "Grant usage on future schemas to DEV_RO",
        command: `GRANT USAGE ON FUTURE SCHEMAS IN DATABASE "${database}" TO ROLE DEV_RO;`,
        role: "SECURITYADMIN",
      },
      {
        description: "Grant SELECT on all tables to DEV_RO",
        command: `GRANT SELECT ON ALL TABLES IN DATABASE "${database}" TO DEV_RO;`,
        role: "SECURITYADMIN",
      },
      {
        description: "Grant SELECT on future tables to DEV_RO",
        command: `GRANT SELECT ON FUTURE TABLES IN DATABASE "${database}" TO ROLE DEV_RO;`,
        role: "SECURITYADMIN",
      },
      {
        description: "Grant SELECT on all views to DEV_RO",
        command: `GRANT SELECT ON ALL VIEWS IN DATABASE "${database}" TO ROLE DEV_RO;`,
        role: "SECURITYADMIN",
      },
    ];

    const totalOperations = sysadminOperations.length + securityadminOperations.length;

    // Execute SYSADMIN operations
    console.log(">>> Executing SYSADMIN operations...\n");
    for (const op of sysadminOperations) {
      try {
        console.log(
          `[${executedOperations.length + 1}/${totalOperations}] [SYSADMIN] ${op.description}`
        );
        console.log(
          `  Executing: ${op.command.substring(0, 80)}${op.command.length > 80 ? "..." : ""}`
        );
        await executeSysadminAsync(op.command);
        executedOperations.push(op);
      } catch (error) {
        const errorStr = errorToString(error);

        // Check if we should skip if already exists
        if (op.skipIfExists && errorStr.includes("already exists")) {
          console.log(`  ⚠️  ${op.description} already exists, continuing...`);
          continue;
        }

        // If operation failed, rollback everything
        console.error(`\n❌ Failed at: ${op.description}`);
        console.error(`   Error: ${errorStr}`);
        console.log("\n>>> Rolling back all changes...\n");

        await rollbackOperations(
          executeSysadminAsync,
          executeSecurityadminAsync,
          executedOperations.reverse()
        );

        return false;
      }
    }

    // Execute SECURITYADMIN operations
    console.log("\n>>> Executing SECURITYADMIN operations...\n");
    for (const op of securityadminOperations) {
      try {
        console.log(
          `[${executedOperations.length + 1}/${totalOperations}] [SECURITYADMIN] ${op.description}`
        );
        console.log(
          `  Executing: ${op.command.substring(0, 80)}${op.command.length > 80 ? "..." : ""}`
        );
        await executeSecurityadminAsync(op.command);
        executedOperations.push(op);
      } catch (error) {
        const errorStr = errorToString(error);

        // If operation failed, rollback everything
        console.error(`\n❌ Failed at: ${op.description}`);
        console.error(`   Error: ${errorStr}`);
        console.log("\n>>> Rolling back all changes...\n");

        await rollbackOperations(
          executeSysadminAsync,
          executeSecurityadminAsync,
          executedOperations.reverse()
        );

        return false;
      }
    }

    console.log("\n✅ Database creation completed successfully!");
    return true;
  } catch (error) {
    console.error("\n❌ Unexpected error:", errorToString(error));
    console.log("\n>>> Rolling back all changes...\n");

    try {
      const executeSysadminAsync = promisifyExecute(sysadminConnection);
      const executeSecurityadminAsync = promisifyExecute(securityadminConnection);
      await rollbackOperations(
        executeSysadminAsync,
        executeSecurityadminAsync,
        executedOperations.reverse()
      );
    } catch (rollbackError) {
      console.error("Error during rollback:", errorToString(rollbackError));
    }

    return false;
  } finally {
    try {
      const destroySysadminAsync = promisifyDestroy(sysadminConnection);
      await destroySysadminAsync();
    } catch (error) {
      console.error("Error destroying SYSADMIN connection: ", errorToString(error));
    }
    try {
      const destroySecurityadminAsync = promisifyDestroy(securityadminConnection);
      await destroySecurityadminAsync();
    } catch (error) {
      console.error("Error destroying SECURITYADMIN connection: ", errorToString(error));
    }
  }
}

async function rollbackOperations(
  executeSysadminAsync: (sqlText: string) => Promise<{
    statement: snowflake.RowStatement;
    rows: any[] | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  }>,
  executeSecurityadminAsync: (sqlText: string) => Promise<{
    statement: snowflake.RowStatement;
    rows: any[] | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  }>,
  operations: Operation[]
): Promise<void> {
  for (const op of operations) {
    if (!op.rollback) {
      continue;
    }

    try {
      console.log(`Rolling back: [${op.role}] ${op.description}`);

      // Use the appropriate connection based on role
      const executeAsync =
        op.role === "SYSADMIN" ? executeSysadminAsync : executeSecurityadminAsync;

      // For database drop, ensure we're not using the database
      if (op.rollback.includes("DROP DATABASE")) {
        try {
          await executeSysadminAsync("USE DATABASE SNOWFLAKE;");
        } catch (error) {
          // Ignore errors when switching context
        }
      }

      // For file format and table drops, ensure we're in the target database
      if (
        (op.rollback.includes("DROP FILE FORMAT") || op.rollback.includes("DROP TABLE")) &&
        op.role === "SYSADMIN"
      ) {
        try {
          await executeSysadminAsync(`USE DATABASE "${database}";`);
        } catch (error) {
          // If database doesn't exist, skip this rollback
          if (errorToString(error).includes("does not exist")) {
            console.log(`  ⚠️  Database doesn't exist, skipping rollback...`);
            continue;
          }
        }
      }

      console.log(`  Executing: ${op.rollback}`);
      await executeAsync(op.rollback);
    } catch (error) {
      const errorStr = errorToString(error);
      // Ignore errors if object doesn't exist (already rolled back or never created)
      if (
        errorStr.includes("does not exist") ||
        errorStr.includes("not found") ||
        errorStr.includes("Unknown") ||
        errorStr.includes("does not exist or not authorized")
      ) {
        console.log(`  ⚠️  Object already removed or doesn't exist, continuing...`);
        continue;
      }
      console.error(`  ⚠️  Rollback failed: ${errorStr}`);
    }
  }
  console.log("\n>>> Rollback completed.");
}

async function main() {
  console.log(createConfirmationTable());
  console.log(`\nThis will create database: ${database}`);
  console.log("The following will be created:");
  console.log("  - Database with SYSADMIN ownership");
  console.log("  - DEV_RO role permissions (read-only access)");
  console.log("  - gzip_csv_format file format");
  console.log("  - PATIENT_MAPPING table\n");

  const confirmed = await askConfirmation("Do you want to proceed? (y/n): ");

  if (!confirmed) {
    console.log("Operation cancelled.");
    process.exit(0);
  }

  const success = await createDatabase();
  process.exit(success ? 0 : 1);
}

main();
