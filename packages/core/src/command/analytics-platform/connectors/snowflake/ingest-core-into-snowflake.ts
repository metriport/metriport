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
import { buildCoreSchemaS3Prefix } from "../core-export-shared";
import { additionalColumnDefs } from "../../csv-to-db/db-asset-defs";
import { parseTableNameFromFhirToCsvIncrementalFileKey } from "../../fhir-to-csv/file-name";

dayjs.extend(duration);

type SnowflakeConnectionSettings = {
  account: string;
  token: string;
  database: string;
  schema: string;
  warehouse: string;
};

/**
 * TODO eng-1179 implement this off of 3-ingest-from-merged-csvs.ts
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

  log(`>>> Running it with cxId: ${cxId}`);
  const startedAt = Date.now();

  // TODO update this
  // TODO update this
  // TODO update this
  // TODO update this
  const inputS3Prefix = buildCoreSchemaS3Prefix({ cxId });
  // const inputS3Prefix =
  // "snowflake/fhir-to-csv-incremental/cx=eae9172a-1c55-437b-bc1a-9689c64e47a1/pt=0194f5f7-c165-7c48-b7fe-cf1f4da02e17";
  const s3Utils = new S3Utils(region);
  // const filesS3 = await s3Utils.listObjects(bucketName, inputS3Prefix);
  const files = await s3Utils.listObjectsV3(bucketName, inputS3Prefix);
  const prefixUrl = `s3://${bucketName}/${inputS3Prefix}`;
  const snowflakeConnectionSettings = getSnowflakeConnectionSettings(
    cxId,
    snowflakeCredsForAllRegions,
    snowflakeSettingsForAllCxs
  );

  // const files = filesS3.flatMap(file => {
  //   if (!file.Key) return [];
  //   return {
  //     key: file.Key,
  //     lastModified: file.LastModified ?? new Date(),
  //     eTag: file.ETag ?? "",
  //     size: file.Size ?? 0,
  //     storageClass: file.StorageClass ?? "",
  //   };
  // });
  if (files.length < 1) {
    log(`>>> No files found in ${inputS3Prefix}, bucket ${bucketName}, leaving.`);
    return;
  }

  log(`Ingesting core data into Snowflake... using: ${region}, s3Prefix ${prefixUrl}`);
  await ingestIntoSnowflake(files, prefixUrl, snowflakeConnectionSettings);

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

async function ingestIntoSnowflake(
  files: S3Object[],
  prefixUrl: string,
  snowflakeConnectionSettings: SnowflakeConnectionSettings
): Promise<void> {
  const connection = snowflake.createConnection({
    ...snowflakeConnectionSettings,
    authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
    clientSessionKeepAlive: true,
  });
  try {
    console.log(">>> Connecting to Snowflake...");
    const connectAsync = promisifyConnect(connection);
    await connectAsync();
    console.log("Connected to Snowflake.");

    const executeAsync = promisifyExecute(connection);
    // await executeAsync(`USE DATABASE ${database}`);
    // await executeAsync(`USE SCHEMA ${schema}`);

    console.log("Ingesting data...");
    // for (const [resourceType, tableName] of Object.entries(tableNames)) {
    for (const file of files) {
      await processFile({
        // resourceType,
        // tableName,
        // columnDefs,
        file,
        executeAsync,
        prefixUrl,
      });
    }

    // return { tableNames };
  } finally {
    try {
      const destroyAsync = promisifyDestroy(connection);
      await destroyAsync();
    } catch (error) {
      console.error("Error destroying connection: ", errorToString(error));
    }
  }
}

async function processFile({
  file,
  executeAsync,
  prefixUrl,
}: {
  file: S3Object;
  executeAsync: (sqlText: string) => Promise<{
    statement: snowflake.RowStatement;
    rows: any[] | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  }>;
  prefixUrl: string;
}) {
  // TODO use some function here
  // TODO use some function here
  // TODO use some function here
  // e.g. of file.key: core-schema/cx=eae9172a-1c55-437b-bc1a-9689c64e47a1/allergyintolerance.csv
  const tableLowercase = file.key.split("/").pop()?.split(".")[0];
  // const resourceType = parseTableNameFromFhirToCsvIncrementalFileKey(file.key);
  if (!tableLowercase) {
    throw new Error(`No resource type found for file: ${file.key}`);
  }
  const tableUppercase = createTableName(tableLowercase);

  // Need the trailing slash to avoid more than one folder from shared prefixes (e.g., condition and condition_code_coding)
  const createStageCmd =
    `CREATE OR REPLACE TEMP STAGE ${tableUppercase} STORAGE_INTEGRATION = ANALYTICS_BUCKET ` +
    `URL = '${prefixUrl}/${tableLowercase}.csv'`;
  // console.log(`Create stage cmd: ${createStageCmd}`);
  await executeAsync(createStageCmd);

  // File format:
  // CREATE FILE FORMAT csv_format
  //   TYPE = CSV FIELD_DELIMITER = ',',
  //   PARSE_HEADER = true,
  //   ESCAPE = '\\\\', FIELD_OPTIONALLY_ENCLOSED_BY = '\"';

  // Do not use IF NOT EXISTS here, we want to make sure we're not duplicating data
  // TODO reconsider importing additionalColumnDefs from csv-to-db/db-asset-defs.ts
  // TODO reconsider importing additionalColumnDefs from csv-to-db/db-asset-defs.ts
  // TODO reconsider importing additionalColumnDefs from csv-to-db/db-asset-defs.ts
  // TODO reconsider importing additionalColumnDefs from csv-to-db/db-asset-defs.ts
  // const createTableCmd = `CREATE TABLE IF NOT EXISTS ${tableName} (${additionalColumnDefs}) ENABLE_SCHEMA_EVOLUTION = TRUE`;
  // const createTableCmd = `
  // CREATE OR REPLACE TABLE ${tableUppercase}
  // USING TEMPLATE (
  //   SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
  //     FROM TABLE(
  //       INFER_SCHEMA(
  //         LOCATION=>'@${tableUppercase}/${tableLowercase}.csv',
  //         FILE_FORMAT=>'csv_format'
  //       )
  //     ))`;
  const createTableCmd = `
      CREATE OR REPLACE TABLE ${tableUppercase}
      ENABLE_SCHEMA_EVOLUTION = TRUE
      USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
          INFER_SCHEMA(
            LOCATION => '@${tableUppercase}',
            FILE_FORMAT => 'csv_format'
          )
        )
      )`;
  // IGNORE_CASE => TRUE
  console.log(`Create table cmd: ${createTableCmd}`);
  await executeAsync(createTableCmd);

  // const alterTableCmd = `ALTER TABLE ${tableUppercase} SET
  //   ENABLE_SCHEMA_EVOLUTION = TRUE,
  //   ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE`;
  // await executeAsync(alterTableCmd);

  console.log(`>>> Copying ${tableLowercase}...`);
  const startedAt = Date.now();
  // const copyCmd = `COPY INTO ${tableUppercase} FROM @${tableUppercase}
  //   FILE_FORMAT = (FORMAT_NAME = 'csv_format' PARSE_HEADER = TRUE)
  //   MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
  //   ON_ERROR = ABORT_STATEMENT`;
  const copyCmd = `COPY INTO ${tableUppercase}
    FROM @${tableUppercase}
    FILE_FORMAT = (
      FORMAT_NAME = 'csv_format'
      PARSE_HEADER = TRUE
      ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE
    )
    MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
    ON_ERROR = 'ABORT_STATEMENT'`; // Grok suggested CONTINUE
  console.log(`Copy cmd: ${copyCmd}`);
  // TODO Chek where it came from to confirm we can't use it
  // TODO Chek where it came from to confirm we can't use it
  // TODO Chek where it came from to confirm we can't use it
  // TODO Chek where it came from to confirm we can't use it
  // ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE
  // PARSE_HEADER = TRUE

  await executeAsync(copyCmd);
  console.log(`... Copied into ${tableLowercase} in ${elapsedTimeAsStr(startedAt)}`);

  const dropStageCmd = `DROP STAGE ${tableUppercase};`;
  await executeAsync(dropStageCmd);
}

function createTableName(resourceType: string): string {
  return resourceType.toUpperCase();
}
