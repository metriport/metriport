import { DbCreds, errorToString, MetriportError } from "@metriport/shared";
import { Client } from "pg";
import { capture, executeAsynchronously, out } from "../../../util";
import { getCxDbName, tableJobName } from "../csv-to-db/db-asset-defs";
import { buildCoreTableS3Prefix } from "../fhir-to-csv/file-name";

const schemaName = "core";
const numberOfParallelExportTablesIntoS3 = 10;

/**
 * Exports the core data from Postgres to S3.
 */
export async function exportCoreToS3({
  cxId,
  dbCreds,
  analyticsBucketName,
  region,
}: {
  cxId: string;
  dbCreds: DbCreds;
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
    })}`
  );

  const cxDbName = getCxDbName(cxId, dbCreds.dbname);
  const dbClient = new Client({
    host: dbCreds.host,
    port: dbCreds.port,
    database: cxDbName,
    user: dbCreds.username,
    password: dbCreds.password,
  });
  try {
    await dbClient.connect();
    log(`Connected to database`);

    const tableNames = await getTableNamesFromDb({ dbClient });

    await runExport({ dbClient, cxId, bucketName: analyticsBucketName, region, log, tableNames });

    log(`Successfully created analytics database`);
  } finally {
    await dbClient.end();
    log(`Disconnected from database`);
  }
}

async function getTableNamesFromDb({ dbClient }: { dbClient: Client }): Promise<string[]> {
  const cmd = `SELECT n.nspname AS "schema", c.relname as name
    FROM pg_class c
      join pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','p')
      AND NOT c.relispartition
      AND n.nspname !~ ALL ('{^pg_,^information_schema$}')
      AND n.nspname = '${schemaName}'
      order by 2`;
  const res = await dbClient.query(cmd);
  return res.rows.map(row => row.name).filter(name => name !== tableJobName);
}

async function runExport({
  bucketName,
  dbClient,
  cxId,
  tableNames,
  region,
  log,
}: {
  bucketName: string;
  dbClient: Client;
  cxId: string;
  tableNames: string[];
  region: string;
  log: typeof console.log;
}): Promise<void> {
  const errors: { tableName: string; error: string }[] = [];
  await executeAsynchronously(
    tableNames,
    async tableName => {
      try {
        log(`Exporting table ${tableName}...`);
        await exportSingleTable({ dbClient, cxId, tableName, bucketName, region });
      } catch (error) {
        log(`Error exporting table ${tableName}: ${errorToString(error)}`);
        errors.push({ tableName, error: errorToString(error) });
      }
    },
    { numberOfParallelExecutions: numberOfParallelExportTablesIntoS3 }
  );
  if (errors.length > 0) {
    log(`Errors exporting tables: ${errors.map(e => `${e.tableName}: ${e.error}`).join(", ")}`);
    throw new MetriportError(`Errors exporting tables to S3`, errors, {
      errors: errors.map(e => `${e.tableName}: ${e.error}`).join(", "),
    });
  }
}

async function exportSingleTable({
  bucketName,
  cxId,
  dbClient,
  tableName,
  region,
}: {
  bucketName: string;
  cxId: string;
  dbClient: Client;
  tableName: string;
  region: string;
}): Promise<void> {
  const s3Key = buildCoreTableS3Prefix({ cxId, tableName });
  const cmd = `SELECT * from aws_s3.query_export_to_s3(
    'SELECT * FROM ${schemaName}.${tableName}', 
    aws_commons.create_s3_uri('${bucketName}', '${s3Key}', '${region}'),
    options :='format csv, header false'
  )`;
  await dbClient.query(cmd);
}
