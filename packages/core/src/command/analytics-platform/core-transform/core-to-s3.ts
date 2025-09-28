import { DbCreds, errorToString, MetriportError } from "@metriport/shared";
import { Client } from "pg";
import { S3Utils } from "../../../external/aws/s3";
import { capture, executeAsynchronously, out } from "../../../util";
import { getCxDbName, getListTableNames, tableJobName } from "../csv-to-db/db-asset-defs";
import { buildCoreSchemaS3Prefix, buildCoreTableS3Prefix } from "../fhir-to-csv/file-name";

const schemaName = "raw";
const numberOfParallelExportTablesIntoS3 = 10;
const numberOfParallelExportDefinitionsIntoS3 = 50;

type TableDefinition = {
  tableName: string;
  columns: ColumnDefinition[];
};

type ColumnDefinition = {
  columnName: string;
  dataType: string;
};

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

    const tableNames = await getTableNamesFromDb({ dbClient, schemaName });
    if (tableNames.length < 1) {
      log(`No tables found in database ${cxDbName}, schema ${schemaName}`);
      return;
    }

    await runExport({ dbClient, cxId, bucketName: analyticsBucketName, region, log, tableNames });

    log(`Successfully created analytics database`);
  } finally {
    await dbClient.end();
    log(`Disconnected from database`);
  }
}

async function getTableNamesFromDb({
  dbClient,
  schemaName,
}: {
  dbClient: Client;
  schemaName: string;
}): Promise<string[]> {
  const cmd = getListTableNames(schemaName);
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

  await exportCodeSchemaDefinition({ dbClient, cxId, bucketName, region });
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

async function exportCodeSchemaDefinition({
  dbClient,
  cxId,
  bucketName,
  region,
}: {
  dbClient: Client;
  cxId: string;
  bucketName: string;
  region: string;
}): Promise<void> {
  const { log } = out(`exportCodeSchemaDefinition - cx ${cxId}`);

  try {
    log(`Exporting core schema definitions...`);

    // Get table definitions from the core schema
    const tableDefinitions = await getTableDefinitions({ dbClient, schemaName });

    // Generate CREATE statements
    const createStatements = generateCreateStatements(tableDefinitions);

    // Upload to S3
    await uploadSchemaDefinitionsToS3({
      cxId,
      bucketName,
      region,
      createStatements,
    });

    log(`Successfully exported core schema definitions`);
  } catch (error) {
    log(`Error exporting core schema definitions: ${errorToString(error)}`);
    throw new MetriportError(`Failed to export core schema definitions`, error, {
      cxId,
      error: errorToString(error),
    });
  }
}

async function getTableDefinitions({
  dbClient,
  schemaName,
}: {
  dbClient: Client;
  schemaName: string;
}): Promise<TableDefinition[]> {
  const tableNames = await getTableNamesFromDb({ dbClient, schemaName });
  const query = `
    SELECT 
      t.table_name,
      c.column_name,
      c.data_type
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name
    WHERE t.table_schema = '${schemaName}'
      AND t.table_name in (${tableNames.map(name => `'${name}'`).join(", ")})
    ORDER BY t.table_name, c.ordinal_position;
  `;

  const result = await dbClient.query(query);

  // Group columns by table
  const tableMap = new Map<string, TableDefinition>();

  for (const row of result.rows) {
    const tableName = row.table_name;

    if (!tableMap.has(tableName)) {
      tableMap.set(tableName, {
        tableName,
        columns: [],
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const table = tableMap.get(tableName)!;
    table.columns.push({
      columnName: row.column_name,
      dataType: row.data_type,
    });
  }

  return Array.from(tableMap.values());
}

type CreateStatement = {
  tableName: string;
  createStatement: string;
};

function generateCreateStatements(tableDefinitions: TableDefinition[]): CreateStatement[] {
  const statements: CreateStatement[] = [];

  for (const table of tableDefinitions) {
    const columnDefinitions: string[] = [];

    for (const column of table.columns) {
      const columnDef = `  "${column.columnName}" ${getSnowflakeDataTypeString(column)}`;
      columnDefinitions.push(columnDef);
    }

    const createStatement = `CREATE TABLE ${table.tableName} (\n${columnDefinitions.join(
      ",\n"
    )}\n);`;
    statements.push({ tableName: table.tableName, createStatement });
  }

  return statements;
}

// move to a snowflake specific file
function getSnowflakeDataTypeString(column: ColumnDefinition): string {
  const pgType = column.dataType.toLowerCase();

  // Map PostgreSQL types to Snowflake types
  switch (pgType) {
    case "text":
    case "varchar":
    case "character varying":
    case "char":
    case "character":
      return "STRING";
    case "integer":
    case "int":
    case "int4":
    case "bigint":
    case "int8":
    case "smallint":
    case "int2":
    case "serial":
    case "bigserial":
    case "smallserial":
      return "NUMBER";
    case "numeric":
    case "decimal":
    case "real":
    case "double precision":
    case "float":
    case "float4":
    case "float8":
      return "NUMBER";
    case "boolean":
    case "bool":
      return "BOOLEAN";
    case "json":
    case "jsonb":
    case "uuid":
    case "array":
      return "VARIANT";
    case "timestamp":
    case "timestamp without time zone":
    case "timestamp with time zone":
    case "timestamptz":
    case "date":
    case "time":
    case "time without time zone":
    case "time with time zone":
    case "timetz":
      return "STRING";
    default:
      // For unknown types, default to STRING
      return "STRING";
  }
}

async function uploadSchemaDefinitionsToS3({
  cxId,
  bucketName,
  region,
  createStatements,
}: {
  cxId: string;
  bucketName: string;
  region: string;
  createStatements: CreateStatement[];
}): Promise<void> {
  await executeAsynchronously(
    createStatements,
    async statement => {
      const s3Key = `${buildCoreSchemaS3Prefix({ cxId })}/_meta/${statement.tableName}.sql`;
      const s3Utils = new S3Utils(region);
      await s3Utils.uploadFile({
        bucket: bucketName,
        key: s3Key,
        file: Buffer.from(statement.createStatement),
        contentType: "text/plain",
      });
    },
    { numberOfParallelExecutions: numberOfParallelExportDefinitionsIntoS3 }
  );
}
