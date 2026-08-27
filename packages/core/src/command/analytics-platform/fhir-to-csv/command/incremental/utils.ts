import { DbCreds, errorToString, MetriportError } from "@metriport/shared";
import csv from "csv-parser";
import { Client } from "pg";
import { S3Utils } from "../../../../../external/aws/s3";
import { capture, out } from "../../../../../util";
import {
  appendExtendedColumnNamesToRow,
  appendExtendedColumnValuesToRow,
  getCxFwhName,
  getInsertTableJobCommand,
  getMarkOldRowsAsDeletedCommand,
  getParameterizedInsertRowsIntoTableCommand,
  getSchemaExistsCommand,
  getSetSchemaCommand,
  TableDefinitions,
} from "../../../fwh/utils";
import { parseTableNameFromFhirToCsvIncrementalFileKey } from "../../file-name";

const MAX_PG_PARAMETERS = 32767;
const DEFAULT_INSERT_BATCH_SIZE = 100;

function getInsertBatchSize(columnCount: number): number {
  const maxRowsForParams = Math.floor(MAX_PG_PARAMETERS / columnCount);
  return Math.min(DEFAULT_INSERT_BATCH_SIZE, maxRowsForParams);
}

type CsvFileKeyAndTableName = { csvFileKey: string; tableName: string };

/**
 * Streams patient CSV files from S3 and inserts them into PostgreSQL database.
 *
 * @param cxId - Customer ID
 * @param patientId - Patient ID for the CSV files
 * @param jobId - Job ID for tracking and logging purposes
 * @param patientCsvsS3Prefix - S3 prefix containing CSV files for this patient
 * @param analyticsBucketName - S3 bucket name containing the CSV files
 * @param region - AWS region where the S3 bucket is located
 * @param dbCreds - Database credentials for PostgreSQL connection
 * @param tablesDefinitions - Record mapping table names to their SQL creation definitions
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
  tablesDefinitions: TableDefinitions;
}): Promise<void> {
  const { log } = out(`sendPatientCsvsToDb - cx ${cxId}, pt ${patientId}, job ${jobId}`);

  const cxFwhName = getCxFwhName({ cxId, dbname: dbCreds.dbname });
  const schemaName = dbCreds.schemaName;
  if (!schemaName) {
    throw new MetriportError(`Schema name not found in db creds`);
  }
  capture.setExtra({
    cxId,
    patientId,
    jobId,
    patientCsvsS3Prefix,
    analyticsBucketName,
    cxFwhName,
    schemaName,
  });
  log(
    `Running with params: ${JSON.stringify({
      jobId,
      patientCsvsS3Prefix,
      analyticsBucketName,
      host: dbCreds.host,
      port: dbCreds.port,
      dbname: dbCreds.dbname,
      cxFwhName,
      schemaName,
    })}`
  );

  const s3Utils = new S3Utils(region);
  let dbClient: Client | undefined;
  try {
    const csvFileKeys = await listCsvFileKeys(s3Utils, analyticsBucketName, patientCsvsS3Prefix);
    if (csvFileKeys.length < 1) {
      log(`No CSV files found in prefix: ${patientCsvsS3Prefix}`);
      return;
    }
    const csvFileKeysAndTableNames = parseCsvFileKeys(csvFileKeys);
    log(`Found ${csvFileKeysAndTableNames.length} CSV files to process`);

    dbClient = new Client({
      host: dbCreds.host,
      port: dbCreds.port,
      database: cxFwhName,
      user: dbCreds.username,
      password: dbCreds.password,
    });
    await dbClient.connect();
    log(`Connected to customer database`);
    await checkSchemaExistsInAnalyticsDb({ dbClient, schemaName, log });
    await useSchemaInAnalyticsDb({ dbClient, schemaName, log });

    let counter = 0;
    for (const { csvFileKey, tableName } of csvFileKeysAndTableNames) {
      try {
        counter += await processCsvFile({
          patientId,
          jobId,
          dbClient,
          s3Utils,
          analyticsBucketName,
          csvFileKey,
          tableName,
          tablesDefinitions,
          log,
        });
      } catch (error) {
        log(`Error processing CSV file ${tableName}: ${errorToString(error)}`);
        throw new MetriportError(`Failed to process CSV file`, error, {
          tableName,
          csvFileKey,
        });
      }
    }

    await finalizeIncrementalJobInDb({ dbClient, jobId, patientId, schemaName });

    const processedTableNames = csvFileKeysAndTableNames.map(item => item.tableName);
    await markOldRowsAsDeleted({
      dbClient,
      patientId,
      jobId,
      schemaName,
      tableNames: processedTableNames,
      log,
    });

    log(
      `Successfully processed ${csvFileKeys.length} CSV files, ${counter} rows inserted, with new job id ${jobId}`
    );
  } finally {
    if (dbClient) await dbClient.end();
    log(`Disconnected from customer database`);
  }
}

async function listCsvFileKeys(
  s3Utils: S3Utils,
  analyticsBucketName: string,
  patientCsvsS3Prefix: string
): Promise<string[]> {
  const csvFiles = await s3Utils.listObjects(analyticsBucketName, patientCsvsS3Prefix);
  return csvFiles.flatMap(file => (file.Key && file.Key.endsWith(".csv") ? [file.Key] : []));
}

function parseCsvFileKeys(csvFileKeys: string[]): CsvFileKeyAndTableName[] {
  const csvFileKeysAndTableNames = csvFileKeys.map(csvFileKey => {
    const tableName = parseTableNameFromFhirToCsvIncrementalFileKey(csvFileKey);
    return { tableName, csvFileKey };
  });
  const tableNames = csvFileKeysAndTableNames.map(item => item.tableName);
  const setOfTableNames = new Set(tableNames);
  if (setOfTableNames.size !== tableNames.length) {
    throw new MetriportError(`Duplicate table names found across CSV files`, undefined, {
      tableNames: tableNames.join(", "),
    });
  }
  return csvFileKeysAndTableNames;
}

async function checkSchemaExistsInAnalyticsDb({
  dbClient,
  schemaName,
  log,
}: {
  dbClient: Client;
  schemaName: string;
  log: typeof console.log;
}): Promise<void> {
  const cmdSchemaExists = getSchemaExistsCommand(schemaName);
  const schemaExists = await dbClient.query(cmdSchemaExists);
  if (schemaExists.rowCount < 1) {
    throw new MetriportError(`Schema ${schemaName} does not exist`, undefined, { schemaName });
  } else {
    log(`Schema ${schemaName} already exists`);
  }
}

async function useSchemaInAnalyticsDb({
  dbClient,
  schemaName,
  log,
}: {
  dbClient: Client;
  schemaName: string;
  log: typeof console.log;
}): Promise<void> {
  const cmdUseSchema = getSetSchemaCommand(schemaName);
  await dbClient.query(cmdUseSchema);
  log(`Using schema: ${schemaName}`);
}

async function finalizeIncrementalJobInDb({
  dbClient,
  patientId,
  jobId,
  schemaName,
}: {
  dbClient: Client;
  patientId: string;
  jobId: string;
  schemaName: string;
}): Promise<void> {
  const cmdInsertTableJob = getInsertTableJobCommand(schemaName);
  await dbClient.query(cmdInsertTableJob, [jobId, patientId]);
}

async function markOldRowsAsDeleted({
  dbClient,
  patientId,
  jobId,
  schemaName,
  tableNames,
  log,
}: {
  dbClient: Client;
  patientId: string;
  jobId: string;
  schemaName: string;
  tableNames: string[];
  log: (msg: string) => void;
}): Promise<void> {
  for (const tableName of tableNames) {
    try {
      const cmd = getMarkOldRowsAsDeletedCommand({ schemaName, tableName });
      const result = await dbClient.query(cmd, [patientId, jobId]);
      if (result.rowCount > 0) {
        log(`Marked ${result.rowCount} old rows as deleted in table ${tableName}`);
      }
    } catch (error) {
      const msg = `Error marking old rows as deleted in table`;
      const errorMsg = errorToString(error);
      log(`${msg}: ${errorMsg}`);
      capture.error(msg, { extra: { patientId, jobId, tableName, error: errorMsg } });
    }
  }
}

async function processCsvFile({
  patientId,
  jobId,
  csvFileKey,
  tableName,
  tablesDefinitions,
  analyticsBucketName,
  dbClient,
  s3Utils,
  log,
}: {
  patientId: string;
  jobId: string;
  csvFileKey: string;
  tableName: string;
  tablesDefinitions: TableDefinitions;
  analyticsBucketName: string;
  dbClient: Client;
  s3Utils: S3Utils;
  log: (msg: string) => void;
}): Promise<number> {
  const { debug } = out(`processCsvFile - pt ${patientId}, job ${jobId}, table ${tableName}`);

  const columns = tablesDefinitions[tableName];
  if (!columns) {
    throw new MetriportError(`No columns definition found for table`, undefined, {
      tableName,
      csvFileKey,
    });
  }
  debug(`Processing CSV file: ${csvFileKey} -> table: ${tableName} with ${columns.length} columns`);

  const extendedColumns = appendExtendedColumnNamesToRow(columns);
  const rowCount = await streamCsvFileToDatabase({
    patientId,
    jobId,
    tableName,
    extendedColumns,
    csvFileKey,
    analyticsBucketName,
    dbClient,
    s3Utils,
    log,
  });

  return rowCount;
}

/**
 * Streams CSV data from S3 and inserts it into the database using proper CSV parsing and batch inserts.
 *
 * Not using PG's s3_import extension because we need to insert additional column(s) to support the
 * append-only mode.
 *
 * Uses for-await-of with pause() to ensure sequential processing and avoid race conditions.
 */
async function streamCsvFileToDatabase({
  patientId,
  jobId,
  tableName,
  extendedColumns,
  csvFileKey,
  analyticsBucketName,
  dbClient,
  s3Utils,
  log,
}: {
  patientId: string;
  jobId: string;
  tableName: string;
  extendedColumns: string[];
  csvFileKey: string;
  analyticsBucketName: string;
  dbClient: Client;
  s3Utils: S3Utils;
  log: (msg: string) => void;
}): Promise<number> {
  const { debug } = out(`streamCsvFileToDatabase - pt ${patientId}, job ${jobId}`);

  let rowCount = 0;
  let batch: string[][] = [];
  const insertBatchSize = getInsertBatchSize(extendedColumns.length);

  const readableStream = await s3Utils.getFileContentsAsReadableStream(
    analyticsBucketName,
    csvFileKey
  );
  const csvStream = readableStream.pipe(csv({ headers: false }));

  for await (const row of csvStream) {
    rowCount++;
    const extendedRow = appendExtendedColumnValuesToRow({
      row: Object.values(row as Record<string, string>),
      patientId,
      jobId,
    });
    if (extendedRow.length !== extendedColumns.length) {
      throw new MetriportError(
        `Row has ${extendedRow.length} columns, but table ${tableName} has ${extendedColumns.length} columns`,
        undefined,
        { csvFileKey, rowCount }
      );
    }
    batch.push(extendedRow);

    if (batch.length >= insertBatchSize) {
      const localBatch = batch;
      batch = [];
      const insertCmd = getParameterizedInsertRowsIntoTableCommand({
        tableName,
        columnNames: extendedColumns,
        rows: localBatch,
      });
      await dbClient.query(insertCmd, localBatch.flat());
      debug(`Inserted ${localBatch.length} rows into table ${tableName}`);
    }
  }

  if (batch.length > 0) {
    const insertCmd = getParameterizedInsertRowsIntoTableCommand({
      tableName,
      columnNames: extendedColumns,
      rows: batch,
    });
    await dbClient.query(insertCmd, batch.flat());
    debug(`Inserted ${batch.length} rows into table ${tableName}`);
  }

  log(`Inserted ${rowCount} rows into table ${tableName}`);
  return rowCount;
}
