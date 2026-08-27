import { DbCreds, elapsedTimeAsStr, errorToString, MetriportError } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { pipeline } from "node:stream/promises";
import { Client } from "pg";
import { to as copyTo } from "pg-copy-streams";
import { createGzip } from "zlib";
import { S3Utils } from "../../../../../external/aws/s3";
import { capture, executeAsynchronously, out } from "../../../../../util";
import { getColumnNamesCommand, getCxFwhName, getListTableNames } from "../../../fwh/utils";
import { buildCoreSchemaMetaTableS3Prefix, buildCoreTableS3Prefix } from "../../file-name";

dayjs.extend(duration);

const numberOfParallelExportTablesIntoS3 = 5;

export const coreExportJobIdColumnName = "core_export_job_id";
export const rawToCoreJobIdColumnName = "raw_to_core_job_id";

/**
 * Exports the core data from Postgres to S3.
 */
export async function exportCoreFromFwhToS3({
  cxId,
  rawToCoreJobId,
  jobId,
  dbCreds,
  analyticsBucketName,
  region,
}: {
  cxId: string;
  rawToCoreJobId: string;
  jobId: string;
  dbCreds: DbCreds;
  analyticsBucketName: string;
  region: string;
}): Promise<number> {
  const { log } = out(`exportCoreToS3 - cx ${cxId}, job ${jobId}`);

  const cxFwhName = getCxFwhName({ cxId, dbname: dbCreds.dbname });
  const schemaName = dbCreds.schemaName;
  if (!schemaName) {
    throw new MetriportError(`Schema name not found in db creds`);
  }
  capture.setExtra({
    cxId,
    rawToCoreJobId,
    jobId,
    analyticsBucketName,
    cxFwhName,
    schemaName,
  });
  log(
    `Running with params: ${JSON.stringify({
      cxId,
      rawToCoreJobId,
      jobId,
      analyticsBucketName,
      host: dbCreds.host,
      port: dbCreds.port,
      dbname: dbCreds.dbname,
      cxFwhName,
      schemaName,
      numberOfParallelExports: numberOfParallelExportTablesIntoS3,
    })}`
  );
  const startTime = Date.now();

  function getDbClient() {
    return new Client({
      host: dbCreds.host,
      port: dbCreds.port,
      database: cxFwhName,
      user: dbCreds.username,
      password: dbCreds.password,
    });
  }
  const tableNames = await getTableNamesFromDb({ getDbClient, schemaName });
  if (tableNames.length < 1) {
    log(`No tables to export`);
    return 0;
  }

  await runExportToS3({
    getDbClient,
    cxId,
    jobId,
    schemaName,
    analyticsBucketName: analyticsBucketName,
    region,
    log,
    tableNames,
    rawToCoreJobId,
  });

  log(
    `Successfully exported analytics database (${tableNames.length} tables) in ${elapsedTimeAsStr(
      startTime
    )}`
  );
  return tableNames.length;
}

async function getTableNamesFromDb({
  getDbClient,
  schemaName,
}: {
  getDbClient: () => Client;
  schemaName: string;
}): Promise<string[]> {
  const dbClient = getDbClient();
  await dbClient.connect();
  try {
    const cmdListTableNames = getListTableNames(schemaName);
    const res = await dbClient.query(cmdListTableNames);
    return res.rows.map(row => row.name);
  } finally {
    await dbClient.end();
  }
}

async function runExportToS3({
  getDbClient,
  cxId,
  jobId,
  schemaName,
  tableNames,
  analyticsBucketName,
  region,
  rawToCoreJobId,
  log,
}: {
  getDbClient: () => Client;
  cxId: string;
  jobId: string;
  tableNames: string[];
  schemaName: string;
  analyticsBucketName: string;
  region: string;
  rawToCoreJobId: string;
  log: typeof console.log;
}): Promise<void> {
  const errors: { tableName: string; error: string }[] = [];
  await executeAsynchronously(
    tableNames,
    async tableName => {
      try {
        log(`Exporting table ${tableName}...`);
        await exportSingleTableCompressed({
          getDbClient,
          cxId,
          jobId,
          schemaName,
          tableName,
          analyticsBucketName,
          region,
          rawToCoreJobId,
        });
      } catch (error) {
        log(`Error exporting table ${tableName}: ${errorToString(error)}`);
        errors.push({ tableName, error: errorToString(error) });
      }
    },
    { numberOfParallelExecutions: numberOfParallelExportTablesIntoS3 }
  );
  log(`Finish uploading files to S3...`);
  if (errors.length > 0) {
    log(`Errors exporting tables: ${errors.map(e => `${e.tableName}: ${e.error}`).join(", ")}`);
    throw new MetriportError(`Errors exporting tables to S3`, errors, {
      errors: errors.map(e => `${e.tableName}: ${e.error}`).join(", "),
    });
  }
}

async function exportSingleTableCompressed({
  cxId,
  jobId,
  getDbClient,
  schemaName,
  tableName,
  analyticsBucketName,
  region,
  rawToCoreJobId,
}: {
  cxId: string;
  jobId: string;
  getDbClient: () => Client;
  schemaName: string;
  tableName: string;
  analyticsBucketName: string;
  region: string;
  rawToCoreJobId: string;
}): Promise<void> {
  const { log } = out(`exportSingleTableCompressed - cx ${cxId}, table ${tableName}`);

  const s3Utils = new S3Utils(region);
  const s3Key = buildCoreTableS3Prefix({ cxId, jobId, tableName }) + ".gz";

  const dbClient = getDbClient();
  await dbClient.connect();
  try {
    const cmdGetColumnNames = getColumnNamesCommand({ schemaName, tableName });
    const columnNames = await dbClient.query(cmdGetColumnNames);
    const columnNamesAsCsv = [
      ...columnNames.rows.map(row => row.column_name as string),
      coreExportJobIdColumnName,
    ].join(",");

    const gzip = createGzip();
    let compressedChunks: Buffer[] = [];

    gzip.on("data", (chunk: Buffer) => compressedChunks.push(chunk));

    const selectQuery = buildExportSelectQuery({ schemaName, tableName, jobId, rawToCoreJobId });
    const countQuery = buildExportCountQuery({ schemaName, tableName, rawToCoreJobId });

    const countRaw = await dbClient.query(countQuery);
    const count = countRaw.rows[0].count as number;
    log(`Loading and compressing ${count} rows...`);

    const startedAt = Date.now();
    const copyCmd = `COPY (${selectQuery}) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',', QUOTE '"', FORCE_QUOTE *)`;
    const stream = dbClient.query(copyTo(copyCmd));
    await pipeline(stream, gzip);

    gzip.end();
    await new Promise<void>((resolve, reject) => {
      gzip.on("end", () => resolve());
      gzip.on("error", reject);
    });

    const gzippedContent = Buffer.concat(compressedChunks);
    const totalSize = gzippedContent.length;
    compressedChunks = [];
    log(
      `Loading/compressing done in ${elapsedTimeAsStr(
        startedAt
      )}, uploading ${totalSize} bytes to ${s3Key}...`
    );

    await Promise.all([
      s3Utils.uploadFile({
        bucket: analyticsBucketName,
        key: buildCoreSchemaMetaTableS3Prefix({ cxId, jobId, tableName }),
        file: Buffer.from(columnNamesAsCsv),
        contentType: "text/csv",
        log,
      }),
      s3Utils.uploadFile({
        bucket: analyticsBucketName,
        key: s3Key,
        file: gzippedContent,
        contentType: "application/gzip",
        log,
      }),
    ]);
    log(`Done in ${elapsedTimeAsStr(startedAt)}`);
  } finally {
    await dbClient.end();
  }
}

function buildExportSelectQuery({
  schemaName,
  tableName,
  jobId,
  rawToCoreJobId,
}: {
  schemaName: string;
  tableName: string;
  jobId: string;
  rawToCoreJobId: string;
}): string {
  return `
    SELECT t.*, '${jobId}' as ${coreExportJobIdColumnName}
    FROM "${schemaName}"."${tableName}" t
    WHERE t."${rawToCoreJobIdColumnName}" = '${rawToCoreJobId}'
  `;
}

function buildExportCountQuery({
  schemaName,
  tableName,
  rawToCoreJobId,
}: {
  schemaName: string;
  tableName: string;
  rawToCoreJobId: string;
}): string {
  return `
    SELECT COUNT(*) as count
    FROM "${schemaName}"."${tableName}" t
    WHERE t."${rawToCoreJobIdColumnName}" = '${rawToCoreJobId}'
  `;
}
