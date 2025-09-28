import { GetObjectCommand } from "@aws-sdk/client-s3";
import { DbCreds, errorToString, MetriportError } from "@metriport/shared";
import csv from "csv-parser";
import { groupBy } from "lodash";
import { Client } from "pg";
import * as stream from "stream";
import { S3Utils } from "../../../external/aws/s3";
import { capture, out } from "../../../util";
import { parseTableNameFromFhirToCsvIncrementalFileKey } from "../fhir-to-csv/file-name";
import {
  additionalColumnDefs,
  createTableJobCommand,
  getCreateIndexCommand,
  getCreateTableCommand,
  getCreateViewJobCommand,
  getCxDbName,
  insertTableJobCommand,
  rawDbSchema,
} from "./db-asset-defs";

const INSERT_BATCH_SIZE = 100;

type ResourceTypeSourceInfo = { resourceType: string; csvS3Key: string; tableName: string }[];

/**
 * Streams patient CSV files from S3 and inserts them into PostgreSQL database.
 *
 * @param param.cxId - Customer ID
 * @param param.patientId - Patient ID
 * @param param.patientCsvsS3Prefix - S3 prefix containing CSV files
 * @param param.analyticsBucketName - S3 bucket name
 * @param param.region - AWS region
 * @param param.dbCreds - Database credentials
 * @param param.tablesDefinitions - Tables definitions
 */
export async function sendPatientCsvsToDb({
  cxId,
  patientId,
  jobId,
  patientCsvsS3Prefix,
  analyticsBucketName,
  region,
  dbCreds,
  tablesDefinitions,
}: {
  cxId: string;
  patientId: string;
  jobId: string;
  patientCsvsS3Prefix: string;
  analyticsBucketName: string;
  region: string;
  dbCreds: DbCreds;
  tablesDefinitions: Record<string, string>;
}): Promise<void> {
  const { log } = out(`sendPatientCsvsToDb - cx ${cxId}, pt ${patientId}`);

  const cxDbName = getCxDbName(cxId, dbCreds.dbname);

  capture.setExtra({ cxId, patientId, jobId, patientCsvsS3Prefix, analyticsBucketName, cxDbName });
  log(
    `Running with params: ${JSON.stringify({
      jobId,
      patientCsvsS3Prefix,
      analyticsBucketName,
      host: dbCreds.host,
      port: dbCreds.port,
      dbname: dbCreds.dbname,
      cxDbName,
      username: dbCreds.username,
      tablesDefinitions: Object.keys(tablesDefinitions).length,
    })}`
  );

  const s3Utils = new S3Utils(region);
  const dbClient = new Client({
    host: dbCreds.host,
    port: dbCreds.port,
    database: cxDbName,
    user: dbCreds.username,
    password: dbCreds.password,
  });

  try {
    // List all CSV files in the S3 prefix
    const csvFileKeys = await listCsvFileKeys(s3Utils, analyticsBucketName, patientCsvsS3Prefix);
    if (csvFileKeys.length < 1) {
      log(`No CSV files found in prefix: ${patientCsvsS3Prefix}`);
      return;
    }
    log(`Found ${csvFileKeys.length} CSV files to process`);

    const resourceTypeSourceInfo = getResourceTypeSourceInfo(csvFileKeys);

    await dbClient.connect();
    log(`Connected to database`);
    await dbClient.query(`SET search_path TO ${rawDbSchema}`);
    log(`Using schema: ${rawDbSchema}`);

    await prepareIncrementalJobInDb({ dbClient });

    let counter = 0;
    for (const { resourceType, csvS3Key, tableName } of resourceTypeSourceInfo) {
      try {
        counter += await processResourceType({
          patientId,
          jobId,
          dbClient,
          s3Utils,
          analyticsBucketName,
          resourceType,
          csvS3Key,
          tableName,
          tablesDefinitions,
          log,
        });
      } catch (error) {
        log(`Error processing CSV file ${resourceType}: ${errorToString(error)}`);
        throw new MetriportError(`Failed to process CSV file ${resourceType}`, error, {
          resourceType,
          csvS3Key,
          tableName,
        });
      }
    }

    await finalizeIncrementalJobInDb({ dbClient, jobId, patientId });

    log(`Successfully processed ${csvFileKeys.length} CSV files, ${counter} rows inserted`);
  } finally {
    await dbClient.end();
    log(`Disconnected from database`);
  }
}

async function listCsvFileKeys(
  s3Utils: S3Utils,
  analyticsBucketName: string,
  patientCsvsS3Prefix: string
): Promise<string[]> {
  const csvFiles = await s3Utils.listObjects(analyticsBucketName, patientCsvsS3Prefix);
  return csvFiles
    .filter(file => file.Key?.endsWith(".csv"))
    .flatMap(file => file.Key ?? [])
    .filter(key => key);
}

/**
 * Returns the CSV file key and DB table name for each resource type.
 */
function getResourceTypeSourceInfo(csvFileKeys: string[]): ResourceTypeSourceInfo {
  const sourceInfoByResourceType = csvFileKeys.map(s3Key => {
    const resourceType = parseTableNameFromFhirToCsvIncrementalFileKey(s3Key);
    const tableName = createTableName(resourceType);
    return { resourceType, tableName, csvS3Key: s3Key };
  });
  const resourceTypesWithMoreThanOneCsvFile = Object.entries(
    groupBy(sourceInfoByResourceType, "resourceType")
  ).filter(([, files]) => files.length > 1);
  if (resourceTypesWithMoreThanOneCsvFile.length > 0) {
    const { log } = out("getResourceTypeSourceInfo");
    const filesAsStr = JSON.stringify(resourceTypesWithMoreThanOneCsvFile);
    log(`Multiple CSV files found for resource type: ${filesAsStr}`);
    throw new MetriportError(`Multiple CSV files found for resource type`, undefined, {
      files: filesAsStr,
    });
  }
  return sourceInfoByResourceType;
}

async function prepareIncrementalJobInDb({ dbClient }: { dbClient: Client }): Promise<void> {
  await dbClient.query(createTableJobCommand);
}

async function finalizeIncrementalJobInDb({
  dbClient,
  patientId,
  jobId,
}: {
  dbClient: Client;
  patientId: string;
  jobId: string;
}): Promise<void> {
  // Once this is done, the DB views will return the newly inserted rows.
  await dbClient.query(insertTableJobCommand, [jobId, patientId]);
}

function createTableName(resourceType: string): string {
  return resourceType.toUpperCase();
}

/**
 * Processes a single CSV file by streaming it from S3 and inserting records into the database.
 */
async function processResourceType({
  patientId,
  jobId,
  resourceType,
  tableName,
  csvS3Key,
  tablesDefinitions,
  analyticsBucketName,
  dbClient,
  s3Utils,
  log,
}: {
  patientId: string;
  jobId: string;
  resourceType: string;
  tableName: string;
  csvS3Key: string;
  tablesDefinitions: Record<string, string>;
  analyticsBucketName: string;
  dbClient: Client;
  s3Utils: S3Utils;
  log: (msg: string) => void;
}): Promise<number> {
  const { debug } = out(`processResourceType - pt ${patientId}, job ${jobId}`);

  const columnsDef = tablesDefinitions[resourceType];
  if (!columnsDef) {
    throw new Error(`No columns definition found for resource type: ${resourceType}`);
  }
  debug(`Processing CSV file: ${csvS3Key} -> table: ${tableName}`);

  const updatedColumnsDefs = `${columnsDef}, ${additionalColumnDefs}`;

  await createTableIfNotExists(dbClient, tableName, updatedColumnsDefs, log);
  debug(`Table ${tableName} created or already exists`);

  const viewName = await createViewIfNotExists(dbClient, tableName, log);
  debug(`View ${viewName} created or already exists`);

  const columnNamesOnCsv = getColumnNamesFromColumnsDef(columnsDef);
  const additionalColumnNames = getColumnNamesFromColumnsDef(additionalColumnDefs);

  const rowCount = await streamCsvToDatabase({
    patientId,
    jobId,
    tableName,
    columnNamesOnCsv,
    additionalColumnNames,
    csvS3Key,
    analyticsBucketName,
    dbClient,
    s3Utils,
    log,
  });

  return rowCount;
}

function getColumnNamesFromColumnsDef(columnsDef: string): string[] {
  return columnsDef
    .split(",")
    .map(column => column.trim().split(/\s+/)[0])
    .filter((name): name is string => name !== undefined);
}

async function createTableIfNotExists(
  client: Client,
  tableName: string,
  columnsDef: string,
  log: (msg: string) => void
): Promise<void> {
  try {
    const createTableCmd = getCreateTableCommand(tableName, columnsDef);
    await client.query(createTableCmd);
    const createIndexCmd = getCreateIndexCommand(tableName);
    await client.query(createIndexCmd);
  } catch (error) {
    log(`Error creating table ${tableName}: ${error}`);
    throw new MetriportError(`Failed to create table ${tableName}`, error, { tableName });
  }
}

async function createViewIfNotExists(
  client: Client,
  tableName: string,
  log: (msg: string) => void
): Promise<string> {
  try {
    const { cmd, viewName } = getCreateViewJobCommand(tableName);
    await client.query(cmd);
    return viewName;
  } catch (error) {
    log(`Error creating view for table ${tableName}: ${error}`);
    throw new MetriportError(`Failed to create view`, error, { tableName });
  }
}

/**
 * Streams CSV data from S3 and inserts it into the database using proper CSV parsing and batch inserts.
 */
async function streamCsvToDatabase({
  patientId,
  jobId,
  tableName,
  columnNamesOnCsv,
  additionalColumnNames,
  csvS3Key,
  analyticsBucketName,
  dbClient,
  s3Utils,
  log,
}: {
  patientId: string;
  jobId: string;
  tableName: string;
  columnNamesOnCsv: string[];
  additionalColumnNames: string[];
  csvS3Key: string;
  analyticsBucketName: string;
  dbClient: Client;
  s3Utils: S3Utils;
  log: (msg: string) => void;
}): Promise<number> {
  const { debug } = out(`streamCsvToDatabase - pt ${patientId}, job ${jobId}`);

  let rowCount = 0;
  let batch: string[][] = [];

  const command = new GetObjectCommand({
    Bucket: analyticsBucketName,
    Key: csvS3Key,
  });
  const response = await s3Utils.s3Client.send(command);
  if (!response.Body) {
    throw new MetriportError(`No body in S3 response`, undefined, { csvS3Key, tableName });
  }

  const readableStream = response.Body as stream.Readable;

  await new Promise<void>((resolve, reject) => {
    readableStream
      .pipe(csv({ headers: false }))
      .on("data", async (row: Record<string, string>) => {
        rowCount++;
        try {
          const values = columnNamesOnCsv
            .map((_, index) => row[index.toString()] ?? "")
            .filter((val): val is string => val !== undefined);

          batch.push(values);

          // Process batch when it reaches the batch size
          if (batch.length >= INSERT_BATCH_SIZE) {
            // important to do this because `batch` is shared across diff calls to this function, so each time we run the await below a new invocation of
            // this function will execute and we need to make sure it has `batch` reset since we're already processing those items on this invocation
            const localBatch = batch;
            batch = [];
            await insertBatchIntoDatabase({
              patientId,
              jobId,
              tableName,
              columnNames: columnNamesOnCsv,
              additionalColumnNames,
              batch: localBatch,
              dbClient,
            });
          }
        } catch (error) {
          reject(new MetriportError(`Failed to process row`, error, { csvS3Key, rowCount }));
        }
      })
      .on("end", async () => {
        try {
          // Process remaining rows in the batch
          if (batch.length > 0) {
            await insertBatchIntoDatabase({
              patientId,
              jobId,
              tableName,
              columnNames: columnNamesOnCsv,
              additionalColumnNames,
              batch,
              dbClient,
            });
          }
          debug(`Processed ${rowCount} rows from ${csvS3Key}`);
          resolve();
        } catch (error) {
          reject(
            new MetriportError(`Failed to process final batch`, error, { csvS3Key, rowCount })
          );
        }
      })
      .on("error", error => {
        log(`Error reading CSV stream: ${errorToString(error)}`);
        reject(new MetriportError(`Failed to read CSV stream`, error, { csvS3Key, rowCount }));
      });
  });

  return rowCount;
}

/**
 * Inserts a batch of rows into the database using a single query for better performance.
 */
async function insertBatchIntoDatabase({
  patientId,
  jobId,
  tableName,
  columnNames,
  additionalColumnNames,
  batch,
  dbClient,
}: {
  patientId: string;
  jobId: string;
  tableName: string;
  columnNames: string[];
  additionalColumnNames: string[];
  batch: string[][];
  dbClient: Client;
}): Promise<void> {
  if (batch.length < 1) return;

  // Create VALUES clause with placeholders for batch insert
  const valuesClauses = batch.map((_, batchIndex) => {
    const rowPlaceholders = [];
    const amountOfPlaceholdersPerRow = columnNames.length + additionalColumnNames.length;
    for (let colIndex = 0; colIndex < amountOfPlaceholdersPerRow; colIndex++) {
      const paramIndex = batchIndex * amountOfPlaceholdersPerRow + colIndex + 1;
      rowPlaceholders.push(`$${paramIndex}`);
    }
    return `(${rowPlaceholders.join(", ")})`;
  });

  const insertQuery = `INSERT INTO ${tableName} (${columnNames.join(
    ", "
  )}, ${additionalColumnNames.join(", ")}) VALUES ${valuesClauses.join(", ")}
  `;

  // Flatten all values and add the additional columns for each row
  const allValues: string[] = [];
  batch.forEach(rowValues => {
    allValues.push(...rowValues, patientId, jobId);
  });

  await dbClient.query(insertQuery, allValues);
}
