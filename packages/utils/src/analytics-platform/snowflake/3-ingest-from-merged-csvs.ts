// 3-ingest-from-merged-csvs.ts
import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { buildMergeCsvsJobPrefix } from "@metriport/core/command/analytics-platform/merge-csvs/file-name";
import { S3Utils } from "@metriport/core/external/aws/s3";
import {
  promisifyConnect,
  promisifyDestroy,
  promisifyExecute,
} from "@metriport/core/external/snowflake/commands";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import * as AWS from "aws-sdk";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import ini from "ini";
import readline from "readline/promises";
import * as snowflake from "snowflake-sdk";
import { elapsedTimeAsStr } from "../../shared/duration";
import { getCxData } from "../../shared/get-cx-data";

dayjs.extend(duration);

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

const cxId = getEnvVarOrFail("CX_ID");
const bucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const s3Utils = new S3Utils(region);

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

const program = new Command();
program
  .name("3-ingest-from-merged-csvs")
  .description("CLI to trigger the ingestion of patients' CSV files into Snowflake")
  .requiredOption("-mrg, --merge-csv-job-id <id>", "The MergeCsv job ID to ingest the CSVs for")
  .showHelpAfterError()
  .action(main);

async function main({ mergeCsvJobId }: { mergeCsvJobId: string }) {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${buildDayjs().toISOString()} ##############`);

  const prefixName = buildMergeCsvsJobPrefix({ cxId, jobId: mergeCsvJobId });
  const prefixUrl = `s3://${bucketName}/${prefixName}`;

  const columnDefs = readConfigs();
  const [{ orgName }, files] = await Promise.all([
    getCxData(cxId, undefined, false),
    s3Utils.listObjects(bucketName, prefixName),
  ]);
  console.log(`Found ${files.length} files in ${prefixUrl}`);

  await displayWarningAndConfirmation(files, orgName, database);
  console.log(`>>> Running it with mergeCsvJobId: ${mergeCsvJobId}`);

  await ingestIntoSnowflake(columnDefs, files, prefixUrl);

  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

async function ingestIntoSnowflake(
  columnDefs: Record<string, string>,
  files: AWS.S3.ObjectList,
  prefixUrl: string
) {
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

    console.log("Creating tables...");
    const tableNames: Record<string, string> = Object.keys(columnDefs).reduce(
      (acc, resourceType) => {
        acc[resourceType] = createTableName(resourceType);
        return acc;
      },
      {} as Record<string, string>
    );
    console.log("Ingesting data...");
    for (const [resourceType, tableName] of Object.entries(tableNames)) {
      await processTable({
        resourceType,
        tableName,
        columnDefs,
        files,
        executeAsync,
        prefixUrl,
      });
    }

    return { tableNames };
  } finally {
    try {
      const destroyAsync = promisifyDestroy(connection);
      await destroyAsync();
    } catch (error) {
      console.error("Error destroying connection: ", errorToString(error));
    }
  }
}

async function processTable({
  resourceType,
  tableName,
  columnDefs,
  files,
  executeAsync,
  prefixUrl,
}: {
  resourceType: string;
  tableName: string;
  columnDefs: Record<string, string>;
  files: AWS.S3.ObjectList;
  executeAsync: (sqlText: string) => Promise<{
    statement: snowflake.RowStatement;
    rows: any[] | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  }>;
  prefixUrl: string;
}) {
  const columnsDef = columnDefs[resourceType];

  // Do not use IF NOT EXISTS here, we want to make sure we're not duplicating data
  const createTableCmd = `CREATE TABLE ${tableName} (${columnsDef})`;
  // console.log(`Create table cmd: ${createTableCmd}`);
  await executeAsync(createTableCmd);

  if (!files.some(file => file.Key?.includes(resourceType))) {
    console.log(`>>> No files found for ${resourceType} - skipping ingestion`);
    return;
  }

  // Need the trailing slash to avoid more than one folder from shared prefixes (e.g., condition and condition_code_coding)
  const createStageCmd =
    `CREATE OR REPLACE TEMP STAGE ${tableName} STORAGE_INTEGRATION = ANALYTICS_BUCKET ` +
    `URL = '${prefixUrl}/${resourceType}/'`;
  // console.log(`Create stage cmd: ${createStageCmd}`);
  await executeAsync(createStageCmd);

  console.log(`>>> Copying ${resourceType}...`);
  const startedAt = Date.now();
  const copyCmd = `COPY INTO ${tableName} FROM @${tableName} FILE_FORMAT = gzip_csv_format ON_ERROR = ABORT_STATEMENT`;
  // console.log(`Copy cmd: ${copyCmd}`);
  await executeAsync(copyCmd);
  console.log(`... Copied into ${resourceType} in ${elapsedTimeAsStr(startedAt)}`);

  const dropStageCmd = `DROP STAGE ${tableName};`;
  await executeAsync(dropStageCmd);
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

// TODO ENG-858 Configs won't be available at runtime in the lambda like this, will need a diff approach
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

async function displayWarningAndConfirmation(
  files: AWS.S3.ObjectList,
  orgName: string,
  dbName: string
) {
  const msg =
    `You are about to ingest ${files.length} files of ` +
    `customer ${orgName} (${cxId}) into Snowflake DB ${dbName}, are you sure?`;
  console.log(msg);
  console.log("Are you sure you want to proceed?");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question("Type 'yes' to proceed: ");
  if (answer !== "yes") {
    console.log("Aborting...");
    process.exit(0);
  }
  rl.close();
}

export default program;
