import { elapsedTimeAsStr, errorToString, MetriportError } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import * as snowflake from "snowflake-sdk";
import { S3Utils } from "../../../../external/aws/s3";
import {
  promisifyConnect,
  promisifyDestroy,
  promisifyExecute,
} from "../../../../external/snowflake/commands";
import { SnowflakeCreds, SnowflakeSettingsForAllCxs } from "../../../../external/snowflake/creds";
import { executeAsynchronously } from "../../../../util/concurrency";
import { validateIdentifier } from "../../../../util/db";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import {
  coreExportJobIdColumnName,
  rawToCoreJobIdColumnName,
} from "../../export-core-from-fwh-to-s3/command/export-core-from-fwh-to-s3/utils";
import {
  buildCoreSchemaMetaTableS3Prefix,
  buildCoreSchemaS3Prefix,
  metaFolderName,
  parseTableNameFromCoreTableS3Prefix,
} from "../../export-core-from-fwh-to-s3/file-name";
import { jobJobIdColumnName, jobPatientIdColumnName, tableJobName } from "../../fwh/utils";
import { buildSnowflakeTableS3Key } from "./file-name";

dayjs.extend(duration);

// Configure snowflake-sdk before any connections are made
snowflake.configure({
  ocspFailOpen: false,
  logLevel: "WARN",
  additionalLogToConsole: false,
});

const fileFormatAtSnowflake = "gzip_csv_format";
const snowflakeSchemaName = "core";

type SnowflakeConnectionSettings = {
  account: string;
  username: string;
  token: string;
  database: string;
  schema: string;
  warehouse: string;
};

type ExecuteSnowflakeCommand = (sqlText: string) => Promise<{
  statement: snowflake.RowStatement;
  rows: any[] | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
}>;

/**
 * Logic to ingest the core data from S3 into Snowflake.
 */
export async function ingestCoreIntoSnowflake({
  cxId,
  coreExportJobId,
  jobId,
  snowflakeCredsForAllRegions,
  snowflakeSettingsForAllCxs,
  analyticsBucketName,
  region,
}: {
  cxId: string;
  coreExportJobId: string;
  jobId: string;
  snowflakeCredsForAllRegions: SnowflakeCreds;
  snowflakeSettingsForAllCxs: SnowflakeSettingsForAllCxs;
  analyticsBucketName: string;
  region: string;
}): Promise<number> {
  const { log } = out(`ingestCoreIntoSnowflake - cx ${cxId}, job ${jobId}`);

  capture.setExtra({
    cxId,
    coreExportJobId,
    jobId,
    analyticsBucketName,
  });
  log(
    `Running with params: ${JSON.stringify({
      cxId,
      coreExportJobId,
      jobId,
      analyticsBucketName,
    })}`
  );
  const startTime = Date.now();

  const snowflakeConnectionSettings = getSnowflakeConnectionSettings(
    cxId,
    snowflakeCredsForAllRegions,
    snowflakeSettingsForAllCxs
  );

  const s3Utils = new S3Utils(region);
  const fileKeys = await getFileNamesFromS3({
    s3Utils,
    analyticsBucketName,
    cxId,
    coreExportJobId,
  });
  if (fileKeys.length < 1) {
    log(`No files to ingest`);
    return 0;
  }

  const snowflakeFileKeys = await copyDataFilesToSnowflakePath({
    cxId,
    jobId,
    fileKeys,
    analyticsBucketName,
    s3Utils,
  });

  await ingestIntoSnowflake({
    cxId,
    coreExportJobId,
    jobId,
    fileKeys: snowflakeFileKeys,
    analyticsBucketName,
    s3Utils,
    snowflakeConnectionSettings,
  });

  log(
    `Successfully ingested core data into Snowflake (${
      fileKeys.length
    } files) in ${elapsedTimeAsStr(startTime)}`
  );
  return fileKeys.length;
}

async function getFileNamesFromS3({
  s3Utils,
  analyticsBucketName,
  cxId,
  coreExportJobId,
}: {
  s3Utils: S3Utils;
  analyticsBucketName: string;
  cxId: string;
  coreExportJobId: string;
}): Promise<string[]> {
  const inputS3Prefix = buildCoreSchemaS3Prefix({ cxId, jobId: coreExportJobId });

  const files = await s3Utils.listObjectsV3(analyticsBucketName, inputS3Prefix);
  const dataFiles = files.filter(
    file => file.Key?.endsWith(".csv.gz") && !file.Key?.includes(metaFolderName)
  );
  return dataFiles.flatMap(file => file.Key ?? []);
}

async function copyDataFilesToSnowflakePath({
  cxId,
  jobId,
  fileKeys,
  analyticsBucketName,
  s3Utils,
}: {
  cxId: string;
  jobId: string;
  fileKeys: string[];
  analyticsBucketName: string;
  s3Utils: S3Utils;
}): Promise<string[]> {
  const { log } = out(`copyDataFilesToSnowflakePath - cx ${cxId}`);
  const snowflakeDataFileKeys: string[] = [];

  const errors: { sourceKey: string; error: string }[] = [];
  await executeAsynchronously(
    fileKeys,
    async sourceKey => {
      const destDataKey = buildSnowflakeTableS3Key({ cxId, jobId, s3Key: sourceKey });
      snowflakeDataFileKeys.push(destDataKey);
      try {
        await s3Utils.copyFile({
          fromBucket: analyticsBucketName,
          fromKey: sourceKey,
          toBucket: analyticsBucketName,
          toKey: destDataKey,
        });
      } catch (error) {
        errors.push({ sourceKey, error: errorToString(error) });
      }
    },
    { numberOfParallelExecutions: 10 }
  );
  if (errors.length > 0) {
    const msg = `Errors copying files`;
    const errorsString = errors.map(e => `${e.sourceKey}: ${e.error}`).join(", ");
    log(`${msg}: ${errorsString}`);
    throw new MetriportError(msg, undefined, {
      errors: errorsString,
    });
  }
  return snowflakeDataFileKeys;
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
    username: settingsForCxRegion.username,
    token: settingsForCxRegion.apiToken,
    database: cxSettings.dbName,
    schema: cxSettings.dbSchema,
    warehouse: settingsForCxRegion.warehouseName,
  };
}

async function ingestIntoSnowflake({
  cxId,
  coreExportJobId,
  jobId,
  fileKeys,
  analyticsBucketName,
  s3Utils,
  snowflakeConnectionSettings,
}: {
  cxId: string;
  coreExportJobId: string;
  jobId: string;
  fileKeys: string[];
  analyticsBucketName: string;
  s3Utils: S3Utils;
  snowflakeConnectionSettings: SnowflakeConnectionSettings;
}): Promise<void> {
  const { log } = out(`ingestIntoSnowflake - cx ${cxId}, job ${jobId}`);

  const { jobTrackerFiles, otherFiles } = separateJobTrackerFiles(fileKeys);

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
    await createSchemaIfNotExists({ schemaName: snowflakeSchemaName, executeAsync, log });
    await executeAsync(`USE SCHEMA ${snowflakeSchemaName};`);

    const ingestedTables: string[] = [];
    const errors: { fileKey: string; error: string }[] = [];
    await executeAsynchronously(
      otherFiles,
      async fileKey => {
        try {
          const tableName = await ingestSingleFileIntoSnowflake({
            cxId,
            coreExportJobId,
            jobId,
            fileKey,
            analyticsBucketName,
            s3Utils,
            executeAsync,
          });
          ingestedTables.push(tableName);
        } catch (error) {
          errors.push({ fileKey, error: errorToString(error) });
        }
      },
      { numberOfParallelExecutions: 10 }
    );
    if (errors.length > 0) {
      const msg = `Errors ingesting files`;
      const errorsString = errors.map(e => `${e.fileKey}: ${e.error}`).join(", ");
      log(`${msg}: ${errorsString}`);
      throw new MetriportError(msg, undefined, {
        errors: errorsString,
      });
    }

    log(`>>> Ingesting job tracker table(s) last...`);
    for (const fileKey of jobTrackerFiles) {
      await ingestSingleFileIntoSnowflake({
        cxId,
        coreExportJobId,
        jobId,
        fileKey,
        analyticsBucketName,
        s3Utils,
        executeAsync,
      });
    }

    log(`>>> Creating views after all data is loaded...`);
    for (const tableName of ingestedTables) {
      await createViewIfNotExists({ tableName, executeAsync, log });
    }
  } finally {
    try {
      const destroyAsync = promisifyDestroy(connection);
      await destroyAsync();
    } catch (error) {
      log("Error destroying connection: ", errorToString(error));
    }
  }
}

function separateJobTrackerFiles(fileKeys: string[]): {
  jobTrackerFiles: string[];
  otherFiles: string[];
} {
  const jobTrackerFiles: string[] = [];
  const otherFiles: string[] = [];
  for (const fileKey of fileKeys) {
    const tableName = parseTableNameFromCoreTableS3Prefix(fileKey);
    if (tableName === tableJobName) {
      jobTrackerFiles.push(fileKey);
    } else {
      otherFiles.push(fileKey);
    }
  }
  return { jobTrackerFiles, otherFiles };
}

async function ingestSingleFileIntoSnowflake({
  cxId,
  coreExportJobId,
  jobId,
  fileKey,
  analyticsBucketName,
  s3Utils,
  executeAsync,
}: {
  cxId: string;
  coreExportJobId: string;
  jobId: string;
  fileKey: string;
  analyticsBucketName: string;
  s3Utils: S3Utils;
  executeAsync: ExecuteSnowflakeCommand;
}): Promise<string> {
  const { log } = out(`processSingleFile - cx ${cxId}, job ${jobId}`);

  const tableName = parseTableNameFromCoreTableS3Prefix(fileKey);
  if (!tableName) {
    throw new MetriportError(`No table name found in file key`, undefined, { fileKey });
  }
  validateIdentifier(tableName, "table name");

  const metaS3Key = buildCoreSchemaMetaTableS3Prefix({ cxId, jobId: coreExportJobId, tableName });
  const metadata = await s3Utils.getFileContentsAsString(analyticsBucketName, metaS3Key);
  const columns = metadata
    .split(",")
    .map(col => col.trim())
    .filter(col => col.length > 0);
  if (columns.length < 1) {
    throw new MetriportError(`No columns found in metadata`, undefined, {
      cxId,
      tableName,
      metaS3Key,
    });
  }
  const columnsForSelect = columns
    .map((column, idx) => `$${idx + 1}::varchar as ${column}`)
    .join(", ");

  await createTableIfNotExists({ tableName, columns, executeAsync, log });

  const stageName = `${tableName}_stage`;
  const stageUrl = `s3://${analyticsBucketName}/${fileKey}`;
  const createStageCmd =
    `CREATE OR REPLACE TEMP STAGE ${stageName} STORAGE_INTEGRATION = ANALYTICS_BUCKET ` +
    `URL = '${stageUrl}'`;
  await executeAsync(createStageCmd);

  log(`>>> Copying ${tableName}...`);
  const startedAt = Date.now();
  const copyCmd = `COPY INTO ${tableName}_table FROM (
      SELECT
        ${columnsForSelect}
      FROM @${stageName}
    )
    FILE_FORMAT = (
      FORMAT_NAME = '${fileFormatAtSnowflake}'
      SKIP_HEADER = 1
      ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE
      ESCAPE = NONE
    )
    ON_ERROR = 'ABORT_STATEMENT'`;

  await executeAsync(copyCmd);
  log(`... Copied into ${tableName} in ${elapsedTimeAsStr(startedAt)}`);

  const dropStageCmd = `DROP STAGE ${stageName};`;
  await executeAsync(dropStageCmd);
  return tableName;
}

async function createSchemaIfNotExists({
  schemaName,
  executeAsync,
  log,
}: {
  schemaName: string;
  executeAsync: ExecuteSnowflakeCommand;
  log: typeof console.log;
}): Promise<void> {
  const createSQL = `CREATE SCHEMA IF NOT EXISTS ${schemaName};`;
  await executeAsync(createSQL);
  log(`Ensured schema ${schemaName} exists.`);
}

async function createTableIfNotExists({
  tableName,
  columns,
  executeAsync,
  log,
}: {
  tableName: string;
  columns: string[];
  log: typeof console.log;
  executeAsync: ExecuteSnowflakeCommand;
}): Promise<void> {
  const createSQL = `CREATE TABLE IF NOT EXISTS ${tableName}_table (
    ${columns.map(col => `${col} VARCHAR`).join(",  ")}
  );`;
  await executeAsync(createSQL);
  log(`Ensured table ${tableName} exists with ${columns.length} columns.`);
}

async function createViewIfNotExists({
  tableName,
  executeAsync,
  log,
}: {
  tableName: string;
  executeAsync: ExecuteSnowflakeCommand;
  log: typeof console.log;
}): Promise<void> {
  if (tableName === tableJobName) {
    log(`Skipping view creation for job tracker table ${tableName}`);
    return;
  }

  const viewName = `${tableName}_view`;
  const createViewSQL = getViewSqlForTable(tableName, viewName);

  await executeAsync(createViewSQL);
  log(`Created view ${viewName}`);
}

function getViewSqlForTable(tableName: string, viewName: string): string {
  const rawToCore = rawToCoreJobIdColumnName.toUpperCase();
  const coreExport = coreExportJobIdColumnName.toUpperCase();
  const mPatientId = jobPatientIdColumnName.toUpperCase();
  const mJobId = jobJobIdColumnName.toUpperCase();
  return `
    CREATE OR REPLACE VIEW ${viewName} AS
    SELECT DISTINCT t.* EXCLUDE (${rawToCore}, ${coreExport})
    FROM ${tableName}_table t
    INNER JOIN (
      SELECT j.${mPatientId}, j.ID AS max_job_id, MAX(j.${rawToCore}) AS max_raw_to_core_job_id
      FROM ${tableJobName}_table j
      INNER JOIN (
        SELECT ${mPatientId}, MAX(ID) AS max_id
        FROM ${tableJobName}_table
        GROUP BY ${mPatientId}
      ) m ON j.${mPatientId} = m.${mPatientId} AND j.ID = m.max_id
      GROUP BY j.${mPatientId}, j.ID
    ) j ON t.${mPatientId} = j.${mPatientId}
      AND t.${mJobId} = j.max_job_id
      AND t.${rawToCore} = j.max_raw_to_core_job_id;
  `;
}
