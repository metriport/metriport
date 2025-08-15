import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  promisifyConnect,
  promisifyDestroy,
  promisifyExecute,
} from "@metriport/core/external/snowflake/commands";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import fs from "fs";
import ini from "ini";
import * as snowflake from "snowflake-sdk";
import { elapsedTimeAsStr } from "../../shared/duration";

/**
 * Script to ingest compressed CSV files into Snowflake.
 *
 * It relies on the mergeCsvJobId to be passed as a parameter. This ID is determined buy the 2nd step in
 * the flow, the script `2-merge-csvs.ts`.
 *
 * It relies on the merged CSV files to be on the configured bucket, with the following structure:
 *
 * ./snowflake/merged/cxId/patientId/jobId/_tmp_fhir-to-csv_output_cxId_patientId_resourceType.csv
 *
 * As a required runtime parameter, it needs the max number of rows to be used from each file found on S3.
 *
 * Set these constants based on the output from the merge-csvs lambda:
 * - patientIds
 * - mergeCsvJobId
 *
 * Set this constant to determine whether to include deletes while updating Snowflake, to strain
 * transaction control:
 * - includeDeletes
 *
 * Set these env vars read with `getEnvVarOrFail`
 *
 * Run it with:
 * - ts-node src/analytics-platform/snowflake/3-ingest-from-merged-csvs.ts <mergeCsvJobId>
 *
 * Example:
 * - ts-node src/analytics-platform/snowflake/3-ingest-from-merged-csvs.ts 2025-08-08T04-38-04
 */

const mergeCsvJobId = process.argv[2];

const cxId = getEnvVarOrFail("CX_ID");
const bucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");

const account = getEnvVarOrFail("SNOWFLAKE_ACCOUNT");
const token = getEnvVarOrFail("SNOWFLAKE_TOKEN");
const database = getEnvVarOrFail("SNOWFLAKE_DB");
const schema = getEnvVarOrFail("SNOWFLAKE_SCHEMA");
const warehouse = getEnvVarOrFail("SNOWFLAKE_WH");

snowflake.configure({
  ocspFailOpen: false,
  logLevel: "WARN",
  additionalLogToConsole: false,
});

// The resource types to be used in the test.
// type ResourceType = "observation" | "patient" | "condition";

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  const columnDefs = readConfigs();

  await initializeTables(columnDefs);

  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

async function initializeTables(columnDefs: Record<string, string>) {
  const connection = snowflake.createConnection({
    account,
    token,
    database,
    schema,
    warehouse,
    authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
    clientSessionKeepAlive: true,
  });
  try {
    // console.log(">>> Connecting to Snowflake...");
    const connectAsync = promisifyConnect(connection);
    await connectAsync();
    // console.log("Connected to Snowflake.");

    const executeAsync = promisifyExecute(connection);
    // await executeAsync(`USE DATABASE ${database}`);
    // await executeAsync(`USE SCHEMA ${schema}`);

    console.log("Creating tables if not exist...");
    const tableNames: Record<string, string> = Object.keys(columnDefs).reduce(
      (acc, resourceType) => {
        acc[resourceType] = createTableName(resourceType);
        return acc;
      },
      {} as Record<string, string>
    );

    for (const [resourceType, tableName] of Object.entries(tableNames)) {
      const columnsDef = columnDefs[resourceType];
      // fs.writeFileSync(`columnsDef_${resourceType}.txt`, columnsDef);

      const createTableCmd = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnsDef})`;
      await executeAsync(createTableCmd);

      const createStageCmd =
        `CREATE STAGE IF NOT EXISTS ${tableName} STORAGE_INTEGRATION = ANALYTICS_BUCKET ` +
        `URL = 's3://${bucketName}/snowflake/merged/${cxId}/run=${mergeCsvJobId}/${resourceType}'`;
      await executeAsync(createStageCmd);

      console.log(`>>> Copying ${resourceType}...`);
      const startedAt = Date.now();
      const copyCmd = `COPY INTO ${tableName} FROM @${tableName} FILE_FORMAT = gzip_csv_format ON_ERROR = SKIP_FILE`;
      await executeAsync(copyCmd);
      console.log(`... Copied ${resourceType} in ${elapsedTimeAsStr(startedAt)}`);

      const dropStageCmd = `DROP STAGE ${tableName};`;
      await executeAsync(dropStageCmd);
    }
    return { tableNames };
  } finally {
    const destroyAsync = promisifyDestroy(connection);
    await destroyAsync();
  }
}

function createTableName(resourceType: string): string {
  return resourceType.toUpperCase();
}

/**
 * Reads from a .ini file and returns the list of properties under [Struct] section.
 */
function readIniFile(path: string): string[] {
  const data = fs.readFileSync(path, "utf8");
  const config = ini.parse(data);

  // Extract properties from the [Struct] section
  const structSection = config.Struct;
  if (!structSection) {
    throw new Error("No [Struct] section found in the INI file");
  }

  // Return the list of property names (keys) from the Struct section
  return Object.keys(structSection);
}

function readConfigs(): Record<string, string> {
  const iniFolder = `../data-transformation/fhir-to-csv/src/parseFhir/configurations`;
  const files = fs.readdirSync(iniFolder);
  const iniFiles = files.filter(file => file.endsWith(".ini"));
  const columnDefs: Record<string, string> = {};

  for (const file of iniFiles) {
    const columns = readIniFile(`${iniFolder}/${file}`);
    const resourceType = file.split("_").slice(1).join("_")?.replace(".ini", "")?.toLowerCase();
    if (!resourceType) {
      throw new Error(`Invalid resource type in file: ${file}`);
    }
    columnDefs[resourceType] = columns.map(column => `${column} VARCHAR`).join(", ");
  }

  return columnDefs;
}

main();
