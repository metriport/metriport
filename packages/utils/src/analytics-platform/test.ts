import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { Config } from "@metriport/core/util/config";
import { sizeInBytes } from "@metriport/core/util/string";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import csv from "csv-parser";
import fs from "fs";
import ini from "ini";
import * as snowflake from "snowflake-sdk";
import * as stream from "stream";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Script to test the approach to send data to Snowflake.
 *
 * It relies on the files from the consolidated to CSV transformation
 * to be on the configured bucket, with the following structure:
 *
 * ./snowflake/fhir-to-csv/cxId/patientId/jobId/_tmp_fhir-to-csv_output_cxId_patientId_resourceType.csv
 *
 * As a required runtime parameter, it needs the max number of rows to be used from each file found on S3.
 *
 * Set these constants based on the output of the custom Tuva exporter:
 * - patientIds
 * - jobId
 *
 * Set this constant to determine whether to include deletes while updating Snowflake, to strain
 * transaction control:
 * - includeDeletes
 *
 * Set these env vars read with `getEnvVarOrFail`
 *
 * Run it with:
 * - ts-node src/external/snowflake/test.ts <maxRowsPerFile>
 *
 * Example:
 * - ts-node src/external/snowflake/test.ts 2
 * - ts-node src/external/snowflake/test.ts 20
 * - ts-node src/external/snowflake/test.ts 200
 */

const patientIds: string[] = [];
const jobId = "";

const includeDeletes = true;

const maxRowsPerFile = Number(process.argv[2]);
if (!maxRowsPerFile) {
  console.log("Usage: node test.ts <maxRowsPerFile>");
  process.exit(1);
}

const timeBetweenTestsInMillis = 2_000;
const numberOfParallelExecutions = 4; // X-Small

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);

const cxId = getEnvVarOrFail("CX_ID");
const account = getEnvVarOrFail("SNOWFLAKE_ACCOUNT");
const token = getEnvVarOrFail("SNOWFLAKE_TOKEN");
const database = getEnvVarOrFail("SNOWFLAKE_DB");
const schema = getEnvVarOrFail("SNOWFLAKE_SCHEMA");
const warehouse = getEnvVarOrFail("SNOWFLAKE_WH");
const bucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");

snowflake.configure({
  ocspFailOpen: false,
  logLevel: "WARN",
  additionalLogToConsole: false,
});

// The resource types to be used in the test.
type ResourceType = "observation" | "patient" | "condition";
type FileNamePerResource = Record<ResourceType, string>;

type Row = string[];
type PatientId = string;

type FileContentsPerResource = Partial<Record<ResourceType, Row[]>>;

type FileContents = Record<PatientId, FileContentsPerResource>;

const columnDefs: Record<ResourceType, string> = {
  observation: readConfig("observation"),
  patient: readConfig("patient"),
  condition: readConfig("condition"),
};

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  console.log("Getting data...");
  const listOfFileContents = await getData();
  const rowsPerResource: Record<ResourceType, Row[]> = {
    observation: [],
    patient: [],
    condition: [],
  };
  for (const fileContentsPerResource of Object.values(listOfFileContents)) {
    for (const resourceType of Object.keys(fileContentsPerResource) as ResourceType[]) {
      rowsPerResource[resourceType].push(...(fileContentsPerResource[resourceType] || []));
    }
  }

  console.log(`Resources to insert:`);
  console.log(`- per resource:`);
  for (const resourceType of Object.keys(rowsPerResource) as ResourceType[]) {
    const size = sizeInBytes(rowsToString(rowsPerResource[resourceType]));
    console.log(`  - ${resourceType}: ${rowsPerResource[resourceType].length} rows, ${size} bytes`);
  }
  console.log(`- amount of pts: ${Object.keys(listOfFileContents).length}`);
  console.log(`Max resources per type/pt: ${maxRowsPerFile}`);
  console.log(`Including deletes? ${includeDeletes}`);

  const { tableNames } = await initializeTables();
  await sleep(100);

  // ------------------------------------------------------------ FIRST RUN

  let localStart = Date.now();
  console.log(`\n################## Sending data with a connection per resource type...`);
  await executeAsynchronously(
    Object.keys(rowsPerResource) as ResourceType[],
    resourceType =>
      sendDataByResource({
        tableNames,
        rows: rowsPerResource[resourceType],
        resourceType,
        idx: 1,
      }),
    { numberOfParallelExecutions, minJitterMillis: 50, maxJitterMillis: 200 }
  );
  console.log(`__________________ It took ${Date.now() - localStart}ms`);

  await sleep(timeBetweenTestsInMillis);

  localStart = Date.now();
  console.log(`\n################## Sending data with a connection per patient...`);
  await executeAsynchronously(
    Object.keys(listOfFileContents) as PatientId[],
    ptId =>
      sendDataByPatient({ tableNames, ptId, rowsByResource: listOfFileContents[ptId], idx: 2 }),
    { numberOfParallelExecutions, minJitterMillis: 50, maxJitterMillis: 200 }
  );
  console.log(`__________________ It took ${Date.now() - localStart}ms`);

  await sleep(timeBetweenTestsInMillis);

  // ------------------------------------------------------------ SECOND RUN

  localStart = Date.now();
  console.log(`\n################## Sending data with a connection per resource type...`);
  await executeAsynchronously(
    Object.keys(rowsPerResource) as ResourceType[],
    resourceType =>
      sendDataByResource({
        tableNames,
        rows: rowsPerResource[resourceType],
        resourceType,
        idx: 3,
      }),
    { numberOfParallelExecutions, minJitterMillis: 50, maxJitterMillis: 200 }
  );
  console.log(`__________________ It took ${Date.now() - localStart}ms`);

  await sleep(timeBetweenTestsInMillis);

  localStart = Date.now();
  console.log(`\n################## Sending data with a connection per patient...`);
  await executeAsynchronously(
    Object.keys(listOfFileContents) as PatientId[],
    ptId =>
      sendDataByPatient({ tableNames, ptId, rowsByResource: listOfFileContents[ptId], idx: 4 }),
    { numberOfParallelExecutions, minJitterMillis: 50, maxJitterMillis: 200 }
  );
  console.log(`__________________ It took ${Date.now() - localStart}ms`);

  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

function promisifyConnect(s: snowflake.Connection) {
  return function (): Promise<snowflake.Connection> {
    return new Promise((resolve, reject) => {
      s.connect((error: unknown, result: snowflake.Connection) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  };
}

function promisifyDestroy(s: snowflake.Connection) {
  return function (): Promise<snowflake.Connection> {
    return new Promise((resolve, reject) => {
      s.destroy((error: unknown, result: snowflake.Connection) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  };
}

function promisifyExecute(s: snowflake.Connection) {
  return function (sqlText: string): Promise<{
    statement: snowflake.RowStatement;
    rows: any[] | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  }> {
    return new Promise((resolve, reject) => {
      s.execute({
        sqlText,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        complete: (error: unknown, statement: snowflake.RowStatement, rows: any[] | undefined) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({
            statement,
            rows: rows || undefined,
          });
        },
      });
    });
  };
}

async function initializeTables(): Promise<{ tableNames: Record<ResourceType, string> }> {
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

    console.log("Creating tables if not exist...");

    const tableNames: Record<ResourceType, string> = {
      observation: createTableName("observation"),
      patient: createTableName("patient"),
      condition: createTableName("condition"),
    };
    for (const [resourceType, tableName] of Object.entries(tableNames) as [
      ResourceType,
      string
    ][]) {
      const columnsDef = columnDefs[resourceType];
      fs.writeFileSync(`columnsDef_${resourceType}.txt`, columnsDef);
      await executeAsync(`CREATE TABLE IF NOT EXISTS ${tableName} (${columnsDef})`);
    }
    return { tableNames };
  } finally {
    const destroyAsync = promisifyDestroy(connection);
    await destroyAsync();
  }
}

function createTableName(resourceType: ResourceType): string {
  return resourceType.toUpperCase();
  // return (
  //   resourceType.toUpperCase() +
  //   "_" +
  //   new Date().toISOString().slice(0, 19).replace(/:/g, "_").replace(/-/g, "_")
  // );
}

async function sendDataByResource({
  tableNames,
  resourceType,
  rows: rowsToInsert,
  idx,
}: {
  tableNames: Record<ResourceType, string>;
  resourceType: ResourceType;
  rows: Row[];
  idx: number;
}): Promise<void> {
  const connection = snowflake.createConnection({
    account,
    token,
    database,
    schema,
    warehouse,
    authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
    clientSessionKeepAlive: true,
  });
  const tableName = tableNames[resourceType];
  try {
    // console.log(">>> Connecting to Snowflake...");
    const connectAsync = promisifyConnect(connection);
    const executeAsync = promisifyExecute(connection);

    await connectAsync();
    // console.log("Connected to Snowflake.");

    if (includeDeletes) {
      const deleteFilter = new Array(16)
        .fill(0)
        .map((_, id) => "pt" + ++id)
        .map(ptId => `OR FILENAME LIKE '%${ptId}%'`)
        .join(" ");
      await executeAsync(`DELETE FROM ${tableName} WHERE 1=2 ${deleteFilter}`);
    }

    // console.log("Inserting data...");
    const sql = `INSERT INTO ${tableName} VALUES ${rowsToString(rowsToInsert)}`;
    // console.log(`SQL: ${sql}`);
    fs.writeFileSync(`inserts_${resourceType}_${idx}.sql`, sql);
    await executeAsync(sql);
  } finally {
    const destroyAsync = promisifyDestroy(connection);
    await destroyAsync();
  }
}

async function sendDataByPatient({
  tableNames,
  ptId,
  rowsByResource,
  idx,
}: {
  tableNames: Record<ResourceType, string>;
  ptId: string;
  rowsByResource: FileContentsPerResource;
  idx: number;
}) {
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
    const executeAsync = promisifyExecute(connection);

    await connectAsync();
    // console.log("Connected to Snowflake.");

    for (const resourceType of Object.keys(rowsByResource) as ResourceType[]) {
      const tableName = tableNames[resourceType];
      const rows = rowsByResource[resourceType] || [];
      if (rows.length < 1) continue;
      if (!tableName) {
        throw new Error(`Table name not found for resource type ${resourceType} - ptId: ${ptId}`);
      }

      if (includeDeletes) {
        await executeAsync(`DELETE FROM ${tableName} WHERE FILENAME LIKE '%${ptId}%'`);
      }

      // console.log("Inserting data...");
      const sql = `INSERT INTO ${tableName} VALUES ${rows
        .map(values => `('${values.join("','")}')`)
        .join(", ")}`;
      // console.log(`SQL: ${sql}`);
      fs.writeFileSync(`inserts_${resourceType}_${ptId}_${idx}.sql`, sql);
      await executeAsync(sql);
    }
  } catch (error) {
    console.log(`Error sending data for ptId: ${ptId} - ${errorToString(error)}`);
    // throw error;
  } finally {
    const destroyAsync = promisifyDestroy(connection);
    await destroyAsync();
  }
}

function rowsToString(rows: Row[]): string {
  return rows.map(values => `('${values.join("','")}')`).join(", ");
}

async function getData(): Promise<FileContents> {
  const patientAndFiles: [string, FileNamePerResource][] = patientIds.map(ptId => {
    const fileNames: FileNamePerResource = {
      observation: buildInputDataS3Key(cxId, ptId, "observation"),
      patient: buildInputDataS3Key(cxId, ptId, "patient"),
      condition: buildInputDataS3Key(cxId, ptId, "condition"),
    };
    return [ptId, fileNames];
  });

  const listOfFileContents: FileContents = {};
  await executeAsynchronously(patientAndFiles, async filePatient => {
    const [ptId, fileNamePerResource] = filePatient;
    await executeAsynchronously(
      Object.entries(fileNamePerResource),
      async ([resourceType, fileName]) => {
        const { rows } = await readCsvFile({ fileName, bucketName });
        listOfFileContents[ptId] = { ...listOfFileContents[ptId], [resourceType]: rows };
      }
    );
  });
  return listOfFileContents;
}

function buildInputDataS3Key(cxId: string, ptId: string, resourceType: string): string {
  return `snowflake/fhir-to-csv/${cxId}/${ptId}/${jobId}/_tmp_fhir-to-csv_output_${cxId}_${ptId}_${resourceType}.csv`;
}

export async function readCsvFile({
  fileName,
  bucketName,
}: {
  fileName: string;
  bucketName: string;
}): Promise<{ rows: Row[] }> {
  let rowIndex = 0;
  let numColumns: number | undefined = undefined;

  const pass = new stream.PassThrough();

  const promise = new Promise<{
    rows: string[][];
  }>(function (resolve, reject) {
    const rows: string[][] = [];
    pass
      .pipe(csv({ headers: false }))
      .on("data", async data => {
        try {
          rowIndex++;
          // limit the amount of rows per file
          if (rowIndex > maxRowsPerFile) {
            // pass.end();
            return;
          }
          const values = csvRowToValues(data);
          if (numColumns == undefined) numColumns = values.length;
          else {
            if (numColumns !== values.length) {
              throw new Error(
                `Diff number of columns in CSV at row ${rowIndex} (${numColumns} !== ${values.length})`
              );
            }
          }
          rows.push(values);
        } catch (error) {
          reject(error);
        }
      })
      .on("end", async () => {
        return resolve({ rows });
      })
      .on("error", reject);
  });
  await s3Utils.getFileContentsIntoStream(bucketName, fileName, pass);

  return await promise;
}

function csvRowToValues(data: Record<string, string>): string[] {
  return Object.values(data)
    .map(v => v.replaceAll("'", "\\'").replaceAll("\n", "").trim())
    .map(v => v.trim());
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

function readConfig(resourceType: ResourceType): string {
  const columns = readIniFile(
    `../data-transformation/fhir-to-csv/src/parseFhir/configurations/config_${resourceType}.ini`
  );
  return columns.map(column => `${column} VARCHAR`).join(", ");
}

main();
