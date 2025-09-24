import { DbCreds, MetriportError } from "@metriport/shared";
import { groupBy } from "lodash";
import { Client } from "pg";
import * as stream from "stream";
import { S3Utils } from "../../../external/aws/s3";
import { out } from "../../../util";
import { parseTableNameFromFhirToCsvIncrementalFileKey } from "../fhir-to-csv/file-name";
import {
  additionalColumnDefs,
  createTableJobCommand,
  getCreateTableCommand,
  getCreateViewJobCommand,
  getDropIndexCommand,
  getInsertTableCommand,
  insertTableJobCommand,
} from "./db-asset-defs";

type ResourceTypeSourceInfo = Record<string, { csvS3Key: string; tableName: string }>;

/**
 * Streams patient CSV files from S3 and inserts them into PostgreSQL database.
 * Each CSV file represents a FHIR resource type (e.g., Patient, Condition, Encounter).
 *
 * @param param.cxId - Customer ID
 * @param param.patientId - Patient ID
 * @param param.patientCsvsS3Prefix - S3 prefix containing CSV files
 * @param param.analyticsBucketName - S3 bucket name
 * @param param.region - AWS region
 * @param param.dbCreds - Database credentials
 */
export async function sendPatientCsvsToDb({
  cxId,
  patientId,
  patientCsvsS3Prefix,
  analyticsBucketName,
  region,
  dbCreds,
  tablesDefinitions,
  jobId,
}: {
  cxId: string;
  patientId: string;
  patientCsvsS3Prefix: string;
  analyticsBucketName: string;
  region: string;
  dbCreds: DbCreds;
  tablesDefinitions: Record<string, string>;
  jobId: string;
}): Promise<void> {
  const { log } = out(`sendPatientCsvsToDb - cx ${cxId}, pt ${patientId}`);
  log(
    `Running with params: ${JSON.stringify({
      cxId,
      patientId,
      patientCsvsS3Prefix,
      analyticsBucketName,
      region,
      host: dbCreds.host,
      port: dbCreds.port,
      dbname: dbCreds.dbname,
      username: dbCreds.username,
      tablesDefinitions: Object.keys(tablesDefinitions).length,
    })}`
  );

  const s3Utils = new S3Utils(region);
  const dbClient = new Client({
    host: dbCreds.host,
    port: dbCreds.port,
    database: dbCreds.dbname,
    user: dbCreds.username,
    password: dbCreds.password,
  });

  try {
    // List all CSV files in the S3 prefix
    const csvFileKeys = await listCsvFileKeys(s3Utils, analyticsBucketName, patientCsvsS3Prefix);
    if (csvFileKeys.length === 0) {
      log(`No CSV files found in prefix: ${patientCsvsS3Prefix}`);
      return;
    }
    log(`Found ${csvFileKeys.length} CSV files to process`);

    const resourceTypeSourceInfo: ResourceTypeSourceInfo = getResourceTypeSourceInfo(
      csvFileKeys,
      tablesDefinitions
    );

    await dbClient.connect();
    log(`Connected to database`);

    await prepareIncrementalJobInDb({ dbClient });

    for (const [resourceType, { csvS3Key, tableName }] of Object.entries(resourceTypeSourceInfo)) {
      try {
        await processResourceType({
          cxId,
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
        log(`Error processing CSV file ${resourceType}: ${error}`);
        throw new MetriportError(`Failed to process CSV file ${resourceType}`, error, {
          resourceType,
          cxId,
          patientId,
        });
      }
    }

    await finalizeIncrementalJobInDb({ dbClient, jobId, cxId, patientId });

    log(`Successfully processed ${csvFileKeys.length} CSV files`);
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
function getResourceTypeSourceInfo(
  csvFileKeys: string[],
  tablesDefinitions: Record<string, string>
): ResourceTypeSourceInfo {
  const csvKeysByResourceType = groupBy(csvFileKeys, parseTableNameFromFhirToCsvIncrementalFileKey);

  const resourceTypeSourceInfo: ResourceTypeSourceInfo = Object.keys(tablesDefinitions).reduce(
    (acc, resourceType) => {
      const csvS3Key = csvKeysByResourceType[resourceType]?.[0];
      if (!csvS3Key) throw new Error(`No CSV file key found for resource type: ${resourceType}`);
      acc[resourceType] = {
        csvS3Key,
        tableName: createTableName(resourceType),
      };
      return acc;
    },
    {} as ResourceTypeSourceInfo
  );

  return resourceTypeSourceInfo;
}

async function prepareIncrementalJobInDb({ dbClient }: { dbClient: Client }): Promise<void> {
  await dbClient.query(createTableJobCommand);
}

async function finalizeIncrementalJobInDb({
  dbClient,
  cxId,
  patientId,
  jobId,
}: {
  dbClient: Client;
  cxId: string;
  patientId: string;
  jobId: string;
}): Promise<void> {
  // Once this is done, the DB views will return the newly inserted rows.
  await dbClient.query(insertTableJobCommand, [jobId, cxId, patientId]);
}

function createTableName(resourceType: string): string {
  return resourceType.toUpperCase();
}

/**
 * Processes a single CSV file by streaming it from S3 and inserting records into the database.
 */
async function processResourceType({
  cxId,
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
  cxId: string;
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
}): Promise<void> {
  const { debug } = out(`processResourceType - cx ${cxId}, pt ${patientId}, job ${jobId}`);

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

  const columnNames = updatedColumnsDefs
    .split(",")
    .map(column => column.trim().replace(/\s+\w+$/, ""));

  await streamCsvToDatabase({
    cxId,
    patientId,
    jobId,
    tableName,
    columnNames,
    csvS3Key,
    analyticsBucketName,
    dbClient,
    s3Utils,
    log,
  });
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
    // Drop the index because we'll be ingesting a lot of data, it should be recreated before
    // we use the views to re-create the core schema
    const dropIndexCmd = getDropIndexCommand(tableName);
    await client.query(dropIndexCmd);
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

async function insertRowIntoDatabase({
  cxId,
  patientId,
  jobId,
  tableName,
  columnNames,
  values,
  dbClient,
}: {
  cxId: string;
  patientId: string;
  jobId: string;
  tableName: string;
  columnNames: string[];
  values: string[];
  dbClient: Client;
}): Promise<void> {
  const insertQuery = getInsertTableCommand(tableName, columnNames);
  await dbClient.query(insertQuery, [...values, cxId, patientId, jobId]);
}

/**
 * Streams CSV data from S3 and inserts it into the database.
 */
async function streamCsvToDatabase({
  cxId,
  patientId,
  jobId,
  tableName,
  columnNames,
  csvS3Key,
  analyticsBucketName,
  dbClient,
  s3Utils,
  log,
}: {
  cxId: string;
  patientId: string;
  jobId: string;
  tableName: string;
  columnNames: string[];
  csvS3Key: string;
  analyticsBucketName: string;
  dbClient: Client;
  s3Utils: S3Utils;
  log: (msg: string) => void;
}): Promise<void> {
  const { debug } = out(`streamCsvToDatabase - cx ${cxId}, pt ${patientId}, job ${jobId}`);

  let rowCount = 0;
  let buffer = "";

  const writableStream = new stream.Writable({
    async write(chunk, encoding, callback) {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

      try {
        for (const line of lines) {
          if (line.trim() === "") continue;

          // TODO should we use csv-parser instead?
          const values = parseCsvLine(line);

          await insertRowIntoDatabase({
            cxId,
            patientId,
            jobId,
            tableName,
            columnNames,
            values,
            dbClient,
          });
          rowCount++;
        }

        callback();
      } catch (error) {
        log(`Error inserting row: ${error}`);
        callback(new MetriportError(`Failed to insert row into ${tableName}`, error, { csvS3Key }));
      }
    },
    async final(callback) {
      try {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          const values = parseCsvLine(buffer);
          if (values.length > 0) {
            await insertRowIntoDatabase({
              cxId,
              patientId,
              jobId,
              tableName,
              columnNames,
              values,
              dbClient,
            });
            rowCount++;
            debug(`Inserted final row into ${tableName}`);
          }
        }
        debug(`Processed ${rowCount} rows from ${csvS3Key}`);
        callback();
      } catch (error) {
        log(`Error inserting final row: ${error}`);
        callback(
          new MetriportError(`Failed to insert final row into ${tableName}`, error, { csvS3Key })
        );
      }
    },
  });

  await s3Utils.getFileContentsIntoStream(analyticsBucketName, csvS3Key, writableStream);
}

/**
 * Parses a CSV line, handling quoted fields and commas within quotes.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === "," && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = "";
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  result.push(current.trim());
  return result;
}
