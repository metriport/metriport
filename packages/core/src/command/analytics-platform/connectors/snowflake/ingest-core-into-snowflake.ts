import { elapsedTimeAsStr, errorToString, MetriportError } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import * as snowflake from "snowflake-sdk";
import { S3Object, S3Utils } from "../../../../external/aws/s3";
import {
  promisifyConnect,
  promisifyDestroy,
  promisifyExecute,
} from "../../../../external/snowflake/commands";
import { SnowflakeCreds, SnowflakeSettingsForAllCxs } from "../../../../external/snowflake/creds";
import { out } from "../../../../util/log";
import {
  buildCoreSchemaMetaTableS3Prefix,
  buildCoreSchemaS3Prefix,
  metaFolderName,
  parseTableNameFromCoreTableS3Prefix,
} from "../core-export-shared";

dayjs.extend(duration);

const fileFormatAtSnowflake = "gzip_csv_format";

type SnowflakeConnectionSettings = {
  account: string;
  token: string;
  database: string;
  schema: string;
  warehouse: string;
};

/**
 * Logic to ingest the core data from S3 into Snowflake.
 */
export async function ingestCoreIntoSnowflake({
  cxId,
  region,
  bucketName,
  snowflakeCredsForAllRegions,
  snowflakeSettingsForAllCxs,
}: {
  cxId: string;
  region: string;
  bucketName: string;
  snowflakeCredsForAllRegions: SnowflakeCreds;
  snowflakeSettingsForAllCxs: SnowflakeSettingsForAllCxs;
}): Promise<void> {
  const { log } = out(`ingestCoreIntoSnowflake - cx ${cxId}`);

  log(`>>> Running it with bucket ${bucketName}, region ${region}`);
  const startedAt = Date.now();

  const inputS3Prefix = buildCoreSchemaS3Prefix({ cxId });
  const s3Utils = new S3Utils(region);
  const files = await s3Utils.listObjectsV3(bucketName, inputS3Prefix);
  const dataFiles = files.filter(
    file => file.key.endsWith(".csv.gz") && !file.key.includes(metaFolderName)
  );
  const prefixUrl = `s3://${bucketName}/${inputS3Prefix}`;
  const snowflakeConnectionSettings = getSnowflakeConnectionSettings(
    cxId,
    snowflakeCredsForAllRegions,
    snowflakeSettingsForAllCxs
  );

  if (dataFiles.length < 1) {
    log(`>>> No files found in ${inputS3Prefix}, bucket ${bucketName}, leaving.`);
    return;
  }

  log(`Ingesting core data into Snowflake: ${dataFiles.length} files, s3Prefix ${prefixUrl}`);
  await ingestIntoSnowflake({
    cxId,
    files: dataFiles,
    bucketName,
    region,
    prefixUrl,
    snowflakeConnectionSettings,
  });

  log(`>>>>>>> Done after ${Date.now() - startedAt}ms`);
}

function getSnowflakeConnectionSettings(
  cxId: string,
  snowflakeCredsForAllRegions: SnowflakeCreds,
  snowflakeSettingsForAllCxs: SnowflakeSettingsForAllCxs
): SnowflakeConnectionSettings {
  const cxSettings = snowflakeSettingsForAllCxs[cxId];
  if (!cxSettings) {
    throw new MetriportError(`No snowflake customer settings`, undefined, { cxId });
  }
  const settingsForCxRegion = snowflakeCredsForAllRegions[cxSettings.region];
  if (!settingsForCxRegion) {
    throw new MetriportError(
      `PROGRAMMING ERROR: No snowflake settings found for cx's region`,
      undefined,
      { cxId, region: cxSettings.region }
    );
  }
  return {
    account: settingsForCxRegion.account,
    token: settingsForCxRegion.apiToken,
    database: cxSettings.dbName,
    schema: cxSettings.dbSchema,
    warehouse: settingsForCxRegion.warehouseName,
  };
}

async function ingestIntoSnowflake({
  cxId,
  files,
  bucketName,
  region,
  prefixUrl,
  snowflakeConnectionSettings,
}: {
  cxId: string;
  files: S3Object[];
  bucketName: string;
  region: string;
  prefixUrl: string;
  snowflakeConnectionSettings: SnowflakeConnectionSettings;
}): Promise<void> {
  const { log } = out(`ingestIntoSnowflake - cx ${cxId}`);

  const connection = snowflake.createConnection({
    ...snowflakeConnectionSettings,
    authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
    clientSessionKeepAlive: true,
  });
  try {
    log(">>> Connecting to Snowflake...");
    const connectAsync = promisifyConnect(connection);
    await connectAsync();
    log("Connected to Snowflake.");

    const executeAsync = promisifyExecute(connection);
    // await executeAsync(`USE DATABASE ${database}`);
    // await executeAsync(`USE SCHEMA ${schema}`);

    log("Ingesting data...");
    for (const file of files) {
      await processFile({ cxId, file, bucketName, region, executeAsync, prefixUrl });
    }

    // TODO ENG-1179 insert the row for the job that will be used by the view to return the latest data
    // TODO ENG-1179 insert the row for the job that will be used by the view to return the latest data
    // TODO ENG-1179 insert the row for the job that will be used by the view to return the latest data
    // TODO ENG-1179 insert the row for the job that will be used by the view to return the latest data
    // TODO ENG-1179 insert the row for the job that will be used by the view to return the latest data
  } finally {
    try {
      const destroyAsync = promisifyDestroy(connection);
      await destroyAsync();
    } catch (error) {
      log("Error destroying connection: ", errorToString(error));
    }
  }
}

async function processFile({
  cxId,
  file,
  bucketName,
  region,
  executeAsync,
  prefixUrl,
}: {
  cxId: string;
  file: S3Object;
  bucketName: string;
  region: string;
  executeAsync: (sqlText: string) => Promise<{
    statement: snowflake.RowStatement;
    rows: any[] | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  }>;
  prefixUrl: string;
}) {
  const { log } = out(`processFile - cx ${cxId}`);

  // e.g. of file.key: snowflake/core-schema/cx=eae9172a-1c55-437b-bc1a-9689c64e47a1/condition.csv
  const tableFilename = parseTableNameFromCoreTableS3Prefix(file.key);
  if (!tableFilename) {
    throw new Error(`No resource type found for file: ${file.key}`);
  }

  const metaS3Key = buildCoreSchemaMetaTableS3Prefix({ cxId, tableName: tableFilename });
  const metadata = await new S3Utils(region).getFileContentsAsString(bucketName, metaS3Key);
  const columns = metadata.split(",");
  const columnsForSelect = columns
    .map((column, idx) => `$${idx + 1}::varchar as "${column}"`)
    .join(", ");

  const tableName = createTableName(tableFilename);

  // Check if table exists
  const existsQuery = `
    SELECT COUNT(*) AS amount FROM information_schema.tables 
    WHERE table_schema = CURRENT_SCHEMA() 
    AND table_name = '${tableName}'
  `;
  // log(`Exists query: ${existsQuery}`);
  const existsResult = await executeAsync(existsQuery);
  const tableExists = parseInt(existsResult.rows?.[0]?.AMOUNT ?? "0") > 0;
  if (!tableExists) {
    const createSQL = `CREATE TABLE ${tableName} (
      ${columns.map(col => `"${col}" VARCHAR`).join(",  ")}
    );`;
    await executeAsync(createSQL);
    log(`Created table ${tableName} with ${columns.length} columns.`);
  } else {
    log(`Table ${tableName} already exists - HEADS UP: no schema evolution in place yet!`);
  }

  const stageName = `${tableName}_stage`;
  const createStageCmd =
    `CREATE OR REPLACE TEMP STAGE ${stageName} STORAGE_INTEGRATION = ANALYTICS_BUCKET ` +
    `URL = '${prefixUrl}/${tableFilename}.csv.gz'`;
  // log(`Create stage cmd: ${createStageCmd}`);
  await executeAsync(createStageCmd);

  log(`>>> Copying ${tableFilename}...`);
  const startedAt = Date.now();
  const copyCmd = `COPY INTO ${tableName} FROM (
      SELECT
        ${columnsForSelect}
      FROM @${stageName}
    )
    FILE_FORMAT = (
      FORMAT_NAME = '${fileFormatAtSnowflake}'
      SKIP_HEADER = 1
      ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE
    )
    ON_ERROR = 'ABORT_STATEMENT'`;
  // log(`Copy cmd: ${copyCmd}`);

  await executeAsync(copyCmd);
  log(`... Copied into ${tableFilename} in ${elapsedTimeAsStr(startedAt)}`);

  const dropStageCmd = `DROP STAGE ${stageName};`;
  await executeAsync(dropStageCmd);
}

function createTableName(resourceType: string): string {
  return resourceType.toUpperCase();
}
