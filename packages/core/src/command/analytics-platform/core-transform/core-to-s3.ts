import {
  DbCredsWithSchema,
  elapsedTimeAsStr,
  errorToString,
  MetriportError,
} from "@metriport/shared";
import { pipeline } from "node:stream/promises";
import { Client } from "pg";
import { to as copyTo } from "pg-copy-streams";
import { createGzip } from "zlib";
import { S3Utils, UploadFileResult } from "../../../external/aws/s3";
import { capture, executeAsynchronously, out } from "../../../util";
import {
  buildCoreSchemaMetaTableS3Prefix,
  buildCoreTableS3Prefix,
} from "../connectors/core-export-shared";
import { getCxDbName, getListTableNames, tableJobName } from "../csv-to-db/db-asset-defs";
import { buildCoreExportJobId } from "./shared";

const numberOfParallelExportTablesIntoS3 = 5;

const coreExportJobIdColumnName = "core_export_job_id";

/**
 * Exports the core data from Postgres to S3.
 */
export async function exportCoreToS3({
  cxId,
  coreExportJobId = buildCoreExportJobId(),
  dbCreds,
  analyticsBucketName,
  region,
}: {
  cxId: string;
  coreExportJobId?: string;
  dbCreds: DbCredsWithSchema;
  analyticsBucketName: string;
  region: string;
}): Promise<void> {
  const { log } = out(`exportCoreToS3 - cx ${cxId}`);

  capture.setExtra({ cxId, dbName: dbCreds.dbname });
  log(
    `Running with params: ${JSON.stringify({
      host: dbCreds.host,
      port: dbCreds.port,
      dbname: dbCreds.dbname,
      username: dbCreds.username,
      numberOfParallelExports: numberOfParallelExportTablesIntoS3,
    })}`
  );
  const startTime = Date.now();

  const cxDbName = getCxDbName(cxId, dbCreds.dbname);
  function getDbClient() {
    return new Client({
      host: dbCreds.host,
      port: dbCreds.port,
      database: cxDbName,
      user: dbCreds.username,
      password: dbCreds.password,
    });
  }
  const tableNames = await getTableNamesFromDb({ getDbClient, schemaName: dbCreds.schemaName });

  await runExport({
    getDbClient,
    cxId,
    coreExportJobId,
    schemaName: dbCreds.schemaName,
    bucketName: analyticsBucketName,
    region,
    log,
    tableNames,
  });

  log(
    `Successfully exported analytics database (${tableNames.length} tables) in ${elapsedTimeAsStr(
      startTime
    )}`
  );
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
    const cmd = getListTableNames(schemaName);
    const res = await dbClient.query(cmd);
    return res.rows.map(row => row.name).filter(name => name !== tableJobName);
  } finally {
    await dbClient.end();
  }
}

async function runExport({
  bucketName,
  getDbClient,
  schemaName,
  cxId,
  coreExportJobId,
  tableNames,
  region,
  log,
}: {
  bucketName: string;
  getDbClient: () => Client;
  schemaName: string;
  cxId: string;
  coreExportJobId: string;
  tableNames: string[];
  region: string;
  log: typeof console.log;
}): Promise<void> {
  if (tableNames.length < 1) {
    log(`No tables to export`);
    return;
  }
  const errors: { tableName: string; error: string }[] = [];
  const uploadPromises: Promise<UploadFileResult>[] = [];
  await executeAsynchronously(
    tableNames,
    async tableName => {
      try {
        log(`Exporting table ${tableName}...`);
        const { uploadPromises } = await exportSingleTableCompressed({
          getDbClient,
          cxId,
          coreExportJobId,
          tableName,
          bucketName,
          region,
          schemaName,
        });
        uploadPromises.push(...uploadPromises);
      } catch (error) {
        log(`Error exporting table ${tableName}: ${errorToString(error)}`);
        errors.push({ tableName, error: errorToString(error) });
      }
    },
    { numberOfParallelExecutions: numberOfParallelExportTablesIntoS3 }
  );
  log(`Finish uploading files to S3...`);
  await Promise.all(uploadPromises);
  if (errors.length > 0) {
    log(`Errors exporting tables: ${errors.map(e => `${e.tableName}: ${e.error}`).join(", ")}`);
    throw new MetriportError(`Errors exporting tables to S3`, errors, {
      errors: errors.map(e => `${e.tableName}: ${e.error}`).join(", "),
    });
  }
}

async function exportSingleTableCompressed({
  bucketName,
  cxId,
  coreExportJobId,
  getDbClient,
  schemaName,
  tableName,
  region,
}: {
  bucketName: string;
  cxId: string;
  coreExportJobId: string;
  getDbClient: () => Client;
  schemaName: string;
  tableName: string;
  region: string;
}): Promise<{ uploadPromises: Promise<UploadFileResult>[] }> {
  const { log } = out(`exportSingleTableCompressed - cx ${cxId}, table ${tableName}`);
  const uploadPromises: Promise<UploadFileResult>[] = [];

  const s3Utils = new S3Utils(region);
  const s3Key = buildCoreTableS3Prefix({ cxId, tableName }) + ".gz";

  const dbClient = getDbClient();
  await dbClient.connect();
  try {
    const columnNames = await dbClient.query(
      `select column_name from information_schema.columns 
         where table_schema = '${schemaName}' 
           and table_name = '${tableName}' 
         order by ordinal_position`
    );
    const columnNamesAsCsv = [
      ...columnNames.rows.map(row => row.column_name),
      coreExportJobIdColumnName,
    ].join(",");
    uploadPromises.push(
      s3Utils.uploadFile({
        bucket: bucketName,
        key: buildCoreSchemaMetaTableS3Prefix({ cxId, tableName }),
        file: Buffer.from(columnNamesAsCsv),
        contentType: "text/csv",
        log,
      })
    );

    const gzip = createGzip();
    let compressedChunks: Buffer[] = [];

    gzip.on("data", (chunk: Buffer) => compressedChunks.push(chunk));

    const countRaw = await dbClient.query(`select count(*) from ${schemaName}.${tableName}`);
    const count = countRaw.rows[0].count as number;
    log(`Loading and compressing ${count} rows...`);

    const startedAt = Date.now();
    const copyCmd = `COPY (SELECT *, '${coreExportJobId}' as ${coreExportJobIdColumnName}  FROM ${schemaName}.${tableName}) TO STDOUT WITH CSV HEADER`;
    // log(`Copy cmd: ${copyCmd}`);
    const stream = dbClient.query(
      // copyTo(`COPY ${schemaName}.${tableName} TO STDOUT WITH CSV HEADER`)
      copyTo(copyCmd)
    );
    await pipeline(stream, gzip);

    // End the gzip stream and wait for completion
    gzip.end();
    // Wait for gzip to finish processing all data
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

    uploadPromises.push(
      s3Utils.uploadFile({
        bucket: bucketName,
        key: s3Key,
        file: gzippedContent,
        contentType: "application/gzip",
        log,
      })
    );
    log(`Done in ${elapsedTimeAsStr(startedAt)}`);
    return { uploadPromises };
  } finally {
    await dbClient.end();
  }
}
