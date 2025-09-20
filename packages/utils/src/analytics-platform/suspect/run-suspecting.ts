import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import {
  promisifyConnect,
  promisifyDestroy,
  promisifyExecute,
} from "@metriport/core/external/snowflake/commands";
import { errorToString, getEnvVarOrFail, MetriportError, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import * as fs from "fs";
import * as path from "path";
import * as snowflake from "snowflake-sdk";
import { elapsedTimeAsStr } from "../../shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "../../shared/folder";
import { initFile } from "../../shared/file";

dayjs.extend(duration);

/**
 * Script to run SQL queries from /query folder against Snowflake.
 * Results are saved to:
 * - Snowflake tables in Core schema
 * - CSV files locally
 * - S3 bucket for archival
 * - API endpoint for suspect import processing
 *
 * Usage:
 * - Set env vars in .env file:
 *   - SNOWFLAKE_ACCOUNT, SNOWFLAKE_TOKEN, SNOWFLAKE_DB, SNOWFLAKE_SCHEMA, SNOWFLAKE_WH
 *   - S3_BUCKET (for CSV uploads)
 *   - API_URL (for API endpoint calls)
 * - Place SQL query files in /query folder at the same level as this script
 * - Run with: ts-node src/analytics-platform/suspect/run-suspecting.ts
 */

const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const bucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const s3Utils = new S3Utils(region);

const account = getEnvVarOrFail("SNOWFLAKE_ACCOUNT");
const token = getEnvVarOrFail("SNOWFLAKE_TOKEN");
const database = getEnvVarOrFail("SNOWFLAKE_DB");
const schema = getEnvVarOrFail("SNOWFLAKE_SCHEMA");
const warehouse = getEnvVarOrFail("SNOWFLAKE_WH");

const confirmationTime = dayjs.duration(1, "seconds");

snowflake.configure({
  ocspFailOpen: false,
  logLevel: "WARN",
  additionalLogToConsole: false,
});

interface QueryFile {
  name: string;
  content: string;
}

interface QueryResult {
  queryName: string;
  rows: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  columns: string[];
}

const getFolderName = buildGetDirPathInside(`suspecting`);
const executionTimestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${buildDayjs().toISOString()} ##############`);

  try {
    initRunsFolder();

    // Read query files from /query folder
    const queryFiles = await readQueryFiles();
    console.log(`Found ${queryFiles.length} query files`);

    if (queryFiles.length === 0) {
      console.log("No query files found in /query folder. Exiting.");
      return;
    }

    // Display warning and confirmation
    await displayWarningAndConfirmation(queryFiles, cxId, database);

    // Execute queries and save results
    await executeQueriesAndSaveResults(queryFiles);
  } catch (error) {
    console.error("Error in main execution:", errorToString(error));
    throw error;
  } finally {
    console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
  }
}

async function readQueryFiles(): Promise<QueryFile[]> {
  const queryDir = path.join(__dirname, "query");

  if (!fs.existsSync(queryDir)) {
    console.log("Query directory does not exist, creating it...");
    fs.mkdirSync(queryDir, { recursive: true });
    return [];
  }

  const files = fs.readdirSync(queryDir);
  const sqlFiles = files.filter(file => file.endsWith(".sql"));

  const queryFiles: QueryFile[] = [];

  for (const file of sqlFiles) {
    const filePath = path.join(queryDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const name = path.basename(file, ".sql");

    queryFiles.push({
      name,
      content: content.trim(),
    });
  }

  return queryFiles;
}

async function displayWarningAndConfirmation(
  queryFiles: QueryFile[],
  cxId: string,
  dbName: string
) {
  const msg =
    `You are about to execute ${queryFiles.length} queries for ` +
    `customer ${cxId} into Snowflake DB ${dbName}, are you sure?`;
  console.log(msg);
  console.log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

async function executeQueriesAndSaveResults(queryFiles: QueryFile[]): Promise<void> {
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
    //console.log("Connected to Snowflake.");

    const executeAsync = promisifyExecute(connection);

    for (const queryFile of queryFiles) {
      console.log(`\n>>> Executing query: ${queryFile.name}`);
      const queryStartTime = Date.now();

      try {
        const { rows } = await executeAsync(queryFile.content);
        if (!rows || rows.length === 0) {
          console.log(`Query ${queryFile.name} returned no results`);
          continue;
        }
        console.log(
          `Query ${queryFile.name} returned ${rows.length} rows in ${elapsedTimeAsStr(
            queryStartTime
          )}`
        );

        const columns = Object.keys(rows[0]);
        const result: QueryResult = {
          queryName: queryFile.name,
          rows,
          columns,
        };

        // Save to Snowflake table
        await saveToSnowflakeTable(result, executeAsync);

        // Save to CSV file
        const csvFilePath = await saveToCsvFile(result);

        // Upload CSV to S3
        const { bucket, key } = await uploadCsvToS3(csvFilePath, result);

        // Call API endpoint with S3 key
        await callApiEndpoint(bucket, key);
      } catch (error) {
        console.error(`Error executing query ${queryFile.name}:`, errorToString(error));
        // Continue with other queries even if one fails
      }
    }
  } finally {
    try {
      const destroyAsync = promisifyDestroy(connection);
      await destroyAsync();
    } catch (error) {
      console.error("Error destroying connection: ", errorToString(error));
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSnowflakeType(value: any): string {
  if (value === null || (typeof value === "string" && value.toLowerCase() === "null")) {
    return "NULL";
  }
  if (typeof value === "string") {
    return "STRING";
  }
  if (typeof value === "boolean") {
    return "BOOLEAN";
  }
  if (typeof value === "number") {
    return "NUMBER";
  }
  if (typeof value === "object") {
    return "VARIANT";
  }
  throw new Error(`Unsupported value type: ${typeof value}`);
}

function getValuesForInsert(result: QueryResult): string[][] {
  const values: string[][] = [];
  for (const row of result.rows) {
    const rowValues: string[] = [];
    for (const col of result.columns) {
      const value = row[col];
      const type = getSnowflakeType(value);
      switch (type) {
        case "NULL":
          rowValues.push("NULL");
          break;
        case "VARIANT":
          rowValues.push(JSON.stringify(value));
          break;
        case "BOOLEAN":
          rowValues.push(value ? "TRUE" : "FALSE");
          break;
        case "NUMBER":
          rowValues.push(value.toString());
          break;
        case "STRING":
          rowValues.push(value);
          break;
        default:
          throw new MetriportError(`Unsupported value type: ${type}`);
      }
    }
    values.push(rowValues);
  }
  return values;
}

async function saveToSnowflakeTable(
  result: QueryResult,
  executeAsync: (sqlText: string) => Promise<{
    statement: snowflake.RowStatement;
    rows: any[] | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  }>
): Promise<void> {
  const tableName = result.queryName.toUpperCase();
  const fullTableName = `CORE.${tableName}`;

  try {
    console.log(`>>> Creating/updating table ${fullTableName} in Snowflake...`);
    const tableStartTime = Date.now();

    const firstRow = result.rows[0];
    if (!firstRow) throw new MetriportError("No rows found in result");

    // Create table with dynamic columns plus updated_at timestamp
    const columnDefs = result.columns
      .map(col => `"${col}" ${getSnowflakeType(firstRow[col])}`)
      .join(", ");
    const createTableSql = `CREATE TABLE IF NOT EXISTS ${fullTableName} (${columnDefs})`;

    await executeAsync(createTableSql);
    console.log(`Created/updated table ${fullTableName} in ${elapsedTimeAsStr(tableStartTime)}`);
    // Insert data
    console.log(`>>> Inserting ${result.rows.length} rows into ${fullTableName}...`);
    const insertStartTime = Date.now();

    const values = getValuesForInsert(result);
    const columns = result.columns.map(c => `"${c}"`).join(", ");
    const columnSelects = result.columns.map(
      (col, index) =>
        `${
          getSnowflakeType(firstRow[col]) === "VARIANT"
            ? `PARSE_JSON($${index + 1})`
            : `$${index + 1}`
        }`
    );
    const insertSql = `INSERT INTO ${fullTableName} (${columns}) SELECT ${columnSelects} FROM VALUES ${values
      .map(v => `(${v.map(v => `'${v.replace(/'/g, "''")}'`).join(",")})`)
      .join(", ")}`;
    await executeAsync(insertSql);

    console.log(
      `Inserted ${result.rows.length} rows into ${fullTableName} in ${elapsedTimeAsStr(
        insertStartTime
      )}`
    );
  } catch (error) {
    console.error(`Error saving to Snowflake table ${fullTableName}:`, errorToString(error));
    throw error;
  }
}

async function saveToCsvFile(result: QueryResult): Promise<string> {
  const filePath = getOutputFilePath(result.queryName);
  initFile(filePath);

  try {
    console.log(`>>> Saving CSV file: ${filePath}`);
    const csvStartTime = Date.now();

    const csvHeader = ["cx_id", ...result.columns].join(",");
    const values = getValuesForInsert(result);

    const csvContent = [
      csvHeader,
      ...values.map(v => `"${cxId}",${v.map(v => `"${v.replace(/"/g, '""')}"`).join(",")}`),
    ].join("\n");

    fs.writeFileSync(filePath, csvContent, "utf-8");
    console.log(
      `Saved CSV file: ${filePath} (${result.rows.length} rows) in ${elapsedTimeAsStr(
        csvStartTime
      )}`
    );

    return filePath;
  } catch (error) {
    console.error(`Error saving CSV file ${filePath}:`, errorToString(error));
    throw error;
  }
}

async function uploadCsvToS3(
  filePath: string,
  result: QueryResult
): Promise<{ bucket: string; key: string }> {
  try {
    console.log(`>>> Uploading CSV to S3: ${filePath}`);
    const uploadStartTime = Date.now();

    const timestamp = buildDayjs().format("YYYY-MM-DD_HH-mm-ss");
    const key = `suspect-data/cx=${cxId}/${result.queryName}/${result.queryName}_${timestamp}.csv`;
    const bucket = bucketName;

    const fileBuffer = fs.readFileSync(filePath);

    await s3Utils.uploadFile({
      bucket,
      key,
      file: fileBuffer,
      contentType: "text/csv",
    });

    console.log(
      `Uploaded CSV to S3: s3://${bucketName}/${key} in ${elapsedTimeAsStr(uploadStartTime)}`
    );
    return { bucket, key };
  } catch (error) {
    console.error(`Error uploading CSV to S3:`, errorToString(error));
    throw error;
  }
}

async function callApiEndpoint(bucket: string, key: string): Promise<void> {
  try {
    console.log(`>>> Calling API endpoint with S3 key: ${key} and bucket: ${bucket}`);
    const apiStartTime = Date.now();
    const url = `${apiUrl}/internal/suspect/import`;
    console.log(`>>> Calling API endpoint with URL: ${url}`);
    const response = await axios.post(url, { key, cxId });

    console.log(`API call successful: ${response.status} in ${elapsedTimeAsStr(apiStartTime)}`);
  } catch (error) {
    console.error(`Error calling API endpoint:`, errorToString(error));
    // Don't throw error - continue with other queries even if API call fails
    console.log("Continuing with next query despite API call failure...");
  }
}

function getOutputFilePath(tableName: string): string {
  const folderName = getFolderName();
  return `${folderName}/${tableName}-${executionTimestamp}.csv`;
}

main();
