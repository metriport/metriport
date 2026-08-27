import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import {
  promisifyConnect,
  promisifyDestroy,
  promisifyExecute,
} from "@metriport/core/external/snowflake/commands";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, MetriportError, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import * as AWS from "aws-sdk";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { chunk } from "lodash";
import path from "path";
import readline from "readline/promises";
import * as snowflake from "snowflake-sdk";
import { elapsedTimeAsStr } from "../../shared/duration";
import { buildPathInsideRunsFolder, initRunsFolder } from "../../shared/folder";
import { getCxData } from "../../shared/get-cx-data";

dayjs.extend(duration);

/**
 * Script to import care gap measure reports and supporting evidence from S3 into Snowflake.
 * Results are saved to:
 * - Snowflake table DATA_PRODUCTS.CARE_GAP
 * - CSV files locally
 * - S3 bucket for archival
 *
 * Usage:
 * - Set env vars in .env file:
 *   - CX_ID (required)
 *   - SNOWFLAKE_ACCOUNT, SNOWFLAKE_TOKEN, SNOWFLAKE_DB, SNOWFLAKE_SCHEMA, SNOWFLAKE_WH
 *   - ANALYTICS_BUCKET_NAME, AWS_REGION
 * - Run with: ts-node src/analytics-platform/care-gap 2-s3-to-snowflake -j <jobId>
 *
 * Examples:
 * - ts-node src/analytics-platform/care-gap 2-s3-to-snowflake -j 2025-01-15T10-30-00
 */

const cxId = getEnvVarOrFail("CX_ID");
const bucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const s3Utils = new S3Utils(region);

const account = getEnvVarOrFail("SNOWFLAKE_ACCOUNT");
const token = getEnvVarOrFail("SNOWFLAKE_TOKEN");
const database = getEnvVarOrFail("SNOWFLAKE_DB");
const schema = getEnvVarOrFail("SNOWFLAKE_SCHEMA");
const warehouse = getEnvVarOrFail("SNOWFLAKE_WH");

const folderName = buildPathInsideRunsFolder(`2-s3-to-snowflake`);

const numberOfParallelDownloads = 100;
const numberOfParallelSnowflakeInserts = 10;

snowflake.configure({
  ocspFailOpen: false,
  logLevel: "WARN",
  additionalLogToConsole: false,
});

const program = new Command();
program
  .name("2-s3-to-snowflake")
  .description("CLI to import care gap results from S3 into Snowflake")
  .requiredOption("-j, --job-id <id>", "The job ID to import care gaps for")
  .showHelpAfterError()
  .action(main);

interface PatientProcessingCareGapFileData {
  patientId: string;
  measureName: string;
  reportKey: string;
  evidenceKey: string;
  error?: unknown;
}

interface PatientProcessingCareGapResult extends PatientProcessingCareGapFileData {
  downloadStatus: "success" | "error";
  snowflakeStatus: "success" | "error" | "skipped";
  errorMessage?: string;
}

interface DownloadResults {
  total: number;
  success: PatientProcessingCareGapFileData[];
  error: PatientProcessingCareGapFileData[];
}

interface PatientCareGapRow {
  PATIENT_ID: string;
  MEASURE_NAME: string;
  MEASURE_CODE: string;
  MEASURE_REPORT_CODE: string;
  MEASURE_REPORT_INITIAL_POPULATION: number;
  MEASURE_REPORT_EXCLUSION: number;
  MEASURE_REPORT_DENOMINATOR: number;
  MEASURE_REPORT_NUMERATOR: number;
  MEASUREMENT_PERIOD_START: string;
  MEASUREMENT_PERIOD_END: string;
  MEASURE_REPORT: Record<string, unknown>;
  SUPPORTING_EVIDENCE: Record<string, unknown>;
  LAST_RUN: string;
  RUN_ID: string;
}

async function main({ jobId }: { jobId: string }) {
  await sleep(50);
  initRunsFolder();
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting at ${buildDayjs().toISOString()}...`);

  const { orgName } = await getCxData(cxId, undefined, false);

  const lastRun = buildDayjs().toISOString();
  const runId = jobId;

  const filePairs = await discoverS3Files(jobId, log);
  if (filePairs.length < 1) {
    log("No matched file pairs found. Exiting.");
    return;
  }

  await displayWarningAndConfirmation(jobId, filePairs, orgName, log);

  const { rows, downloadResults } = await processFilePairs(filePairs, lastRun, runId, log);

  let snowflakeSuccess = false;
  if (rows.length > 0) {
    try {
      await insertIntoSnowflake(rows, log);
      snowflakeSuccess = true;
    } catch (error) {
      log(`Error importing to Snowflake: ${errorToString(error)}`);
    }
  }

  const processingResults = buildProcessingResults(downloadResults, snowflakeSuccess);
  const resultsCsvPath = writeResultsCsv(processingResults, jobId, log);

  log(`\n>>>>>>> Completed successfully!`);
  log(`Job ID: ${jobId}`);
  log(`File pairs processed: ${downloadResults.total}`);
  log(`Download successes: ${downloadResults.success.length}`);
  log(`Download errors: ${downloadResults.error.length}`);
  log(`Rows imported to Snowflake: ${snowflakeSuccess ? rows.length : 0}`);
  log(`Results CSV: ${resultsCsvPath}`);
  log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

function extractPatientIdFromPath(path: string): string {
  const parts = path.split("/");
  const ptPart = parts.find(part => part.startsWith("pt="));
  if (!ptPart) {
    throw new MetriportError("Could not extract patient ID from path", undefined, { path });
  }
  return ptPart.substring(3);
}

function extractMeasureNameFromPath(path: string): string {
  const parts = path.split("/");
  if (parts.length < 2) {
    throw new MetriportError("Invalid path format: cannot extract measure name", undefined, {
      path,
    });
  }
  const measurePart = parts[parts.length - 2];
  return measurePart;
}

function getPopulationFlag(
  population: Array<{ code?: { coding?: Array<{ code?: string }> }; count?: number }>,
  code: string
): number {
  const pop = population.find(p => p.code?.coding?.[0]?.code === code);
  return pop && pop.count && pop.count > 0 ? 1 : 0;
}

function createS3Prefix(jobId: string): string {
  return `care-gaps/cx=${cxId}/job=${jobId}/`;
}

async function discoverS3Files(
  jobId: string,
  log: typeof console.log
): Promise<PatientProcessingCareGapFileData[]> {
  const prefix = createS3Prefix(jobId);
  log(`>>> Listing S3 objects with prefix: ${prefix}`);

  const objects = await s3Utils.listObjects(bucketName, prefix);
  const reportFiles = objects.filter((obj: AWS.S3.Object) => obj.Key?.endsWith("report.json"));
  const evidenceFiles = objects.filter((obj: AWS.S3.Object) =>
    obj.Key?.endsWith("supporting-evidence.json")
  );

  log(
    `Found ${reportFiles.length} report.json files and ${evidenceFiles.length} supporting-evidence.json files`
  );

  const filePairsMap = new Map<string, PatientProcessingCareGapFileData>();

  for (const reportFile of reportFiles) {
    if (!reportFile.Key) continue;
    const patientId = extractPatientIdFromPath(reportFile.Key);
    const measureName = extractMeasureNameFromPath(reportFile.Key);
    const mapKey = `${patientId}-${measureName}`;

    const existing = filePairsMap.get(mapKey);
    if (existing) {
      existing.reportKey = reportFile.Key;
    } else {
      filePairsMap.set(mapKey, {
        patientId,
        measureName,
        reportKey: reportFile.Key,
        evidenceKey: "",
      });
    }
  }

  for (const evidenceFile of evidenceFiles) {
    if (!evidenceFile.Key) continue;
    const patientId = extractPatientIdFromPath(evidenceFile.Key);
    const measureName = extractMeasureNameFromPath(evidenceFile.Key);
    const mapKey = `${patientId}-${measureName}`;

    const existing = filePairsMap.get(mapKey);
    if (existing) {
      existing.evidenceKey = evidenceFile.Key;
    } else {
      filePairsMap.set(mapKey, {
        patientId,
        measureName,
        reportKey: "",
        evidenceKey: evidenceFile.Key,
      });
    }
  }

  const readyPairs = Array.from(filePairsMap.values()).filter(
    pair => pair.reportKey && pair.evidenceKey
  );

  return readyPairs;
}

async function processFilePairs(
  filePairs: PatientProcessingCareGapFileData[],
  lastRun: string,
  runId: string,
  log: typeof console.log
): Promise<{ rows: PatientCareGapRow[]; downloadResults: DownloadResults }> {
  if (filePairs.length < 1)
    return { rows: [], downloadResults: { total: 0, success: [], error: [] } };
  log(`>>> Processing ${filePairs.length} file pairs...`);
  const downloadResults: DownloadResults = {
    total: filePairs.length,
    success: [] as PatientProcessingCareGapFileData[],
    error: [] as PatientProcessingCareGapFileData[],
  };
  const rows: PatientCareGapRow[] = [];

  await executeAsynchronously(
    filePairs,
    async (pair: PatientProcessingCareGapFileData): Promise<void> => {
      try {
        const [reportContent, evidenceContent] = await Promise.all([
          s3Utils.getFileContentsAsString(bucketName, pair.reportKey),
          s3Utils.getFileContentsAsString(bucketName, pair.evidenceKey),
        ]);

        const measureReport = JSON.parse(reportContent);
        const supportingEvidence = JSON.parse(evidenceContent);

        // Validate MeasureReport structure
        if (!measureReport.resourceType || measureReport.resourceType !== "MeasureReport") {
          throw new MetriportError(
            "Invalid MeasureReport: missing or invalid resourceType",
            undefined,
            {
              reportKey: pair.reportKey,
            }
          );
        }

        if (
          !measureReport.group ||
          !Array.isArray(measureReport.group) ||
          measureReport.group.length < 1
        ) {
          throw new MetriportError(
            "Invalid MeasureReport: missing or empty group array",
            undefined,
            {
              reportKey: pair.reportKey,
            }
          );
        }

        const firstGroup = measureReport.group[0];
        if (!firstGroup.code || !firstGroup.code.coding || !Array.isArray(firstGroup.code.coding)) {
          throw new MetriportError(
            "Invalid MeasureReport: missing code in first group",
            undefined,
            {
              reportKey: pair.reportKey,
            }
          );
        }

        // Extract flattened fields
        const measureReportCode = firstGroup.code.coding[0]?.code ?? "";
        const population = firstGroup.population || [];

        const initialPopulation = getPopulationFlag(population, "initial-population");
        const exclusion = getPopulationFlag(population, "denominator-exclusion");
        const denominator = getPopulationFlag(population, "denominator");
        const numerator = getPopulationFlag(population, "numerator");

        const periodStart = measureReport.period?.start ?? "";
        const periodEnd = measureReport.period?.end ?? "";

        // Extract measure code (e.g., "BCSE" from "BCSE_Details-2025.1.0")
        const measureCode = pair.measureName.split("_")[0];

        // Extract patient ID from subject.reference
        const patientId = pair.patientId;
        if (measureReport.subject?.reference) {
          const ref = measureReport.subject.reference;
          // Try to extract UUID from reference (handles formats like "Patient/xxx" or "patient.xxx.yyy")
          const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
          const match = ref.match(uuidRegex);
          if (match) {
            const refPatientId = match[0];
            if (refPatientId !== patientId) {
              log(
                `Patient ID mismatch: path has ${patientId}, MeasureReport has ${refPatientId}. Using path ID.`
              );
            }
          }
        }

        const row: PatientCareGapRow = {
          PATIENT_ID: patientId,
          MEASURE_NAME: pair.measureName,
          MEASURE_CODE: measureCode,
          MEASURE_REPORT_CODE: measureReportCode,
          MEASURE_REPORT_INITIAL_POPULATION: initialPopulation,
          MEASURE_REPORT_EXCLUSION: exclusion,
          MEASURE_REPORT_DENOMINATOR: denominator,
          MEASURE_REPORT_NUMERATOR: numerator,
          MEASUREMENT_PERIOD_START: periodStart,
          MEASUREMENT_PERIOD_END: periodEnd,
          MEASURE_REPORT: measureReport,
          SUPPORTING_EVIDENCE: supportingEvidence,
          LAST_RUN: lastRun,
          RUN_ID: runId,
        };

        rows.push(row);
        downloadResults.success.push(pair);
      } catch (error) {
        log(
          `Error processing pair (patient ${pair.patientId}, measure ${
            pair.measureName
          }): ${errorToString(error)}`
        );
        downloadResults.error.push({ ...pair, error });
      }
    },
    {
      numberOfParallelExecutions: numberOfParallelDownloads,
    }
  );

  log(
    `Processed ${downloadResults.success.length} valid rows (${downloadResults.error.length} errors)`
  );
  return { rows, downloadResults };
}

function getSnowflakeType(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "string") {
    return "STRING";
  }
  if (typeof value === "boolean") {
    return "BOOLEAN";
  }
  if (typeof value === "number") {
    return "NUMBER";
  }
  if (typeof value === "object") {
    return "OBJECT";
  }
  throw new Error(`Unsupported value type: ${typeof value}`);
}

/**
 * Escape a string value for Snowflake SQL.
 * Handles single quotes and backslashes.
 */
function escapeForSnowflake(value: string): string {
  // Escape backslashes first, then single quotes
  return value.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

/**
 * Validate and stringify JSON, ensuring it's valid.
 */
function safeJsonStringify(value: unknown, columnName: string, patientId: string): string {
  try {
    const jsonStr = JSON.stringify(value);
    // Validate by parsing it back
    JSON.parse(jsonStr);
    return jsonStr;
  } catch (error) {
    throw new MetriportError(`Invalid JSON for column ${columnName}`, error, {
      patientId,
      columnName,
    });
  }
}

function getValuesForInsert(
  rows: PatientCareGapRow[],
  log: typeof console.log
): { values: string[][]; skipped: PatientCareGapRow[] } {
  const values: string[][] = [];
  const skipped: PatientCareGapRow[] = [];

  const columns: (keyof PatientCareGapRow)[] = [
    "PATIENT_ID",
    "MEASURE_NAME",
    "MEASURE_CODE",
    "MEASURE_REPORT_CODE",
    "MEASURE_REPORT_INITIAL_POPULATION",
    "MEASURE_REPORT_EXCLUSION",
    "MEASURE_REPORT_DENOMINATOR",
    "MEASURE_REPORT_NUMERATOR",
    "MEASUREMENT_PERIOD_START",
    "MEASUREMENT_PERIOD_END",
    "MEASURE_REPORT",
    "SUPPORTING_EVIDENCE",
    "LAST_RUN",
    "RUN_ID",
  ];

  for (const row of rows) {
    try {
      const rowValues: string[] = [];

      for (const col of columns) {
        const value = row[col];
        const type = getSnowflakeType(value);
        switch (type) {
          case "NULL":
            rowValues.push("NULL");
            break;
          case "OBJECT":
            rowValues.push(safeJsonStringify(value, col, row.PATIENT_ID));
            break;
          case "BOOLEAN":
            rowValues.push(value ? "TRUE" : "FALSE");
            break;
          case "NUMBER":
            rowValues.push(value?.toString() ?? "NULL");
            break;
          case "STRING":
            rowValues.push(String(value ?? ""));
            break;
          default:
            throw new MetriportError(`Unsupported value type: ${type}`);
        }
      }
      values.push(rowValues);
    } catch (error) {
      log(
        `Skipping row for patient ${row.PATIENT_ID}, measure ${row.MEASURE_NAME}: ${errorToString(
          error
        )}`
      );
      skipped.push(row);
    }
  }

  return { values, skipped };
}

async function insertIntoSnowflake(
  rows: PatientCareGapRow[],
  log: typeof console.log
): Promise<void> {
  if (rows.length < 1) return;
  log(`>>> Inserting ${rows.length} rows into Snowflake...`);

  const connection = snowflake.createConnection({
    account,
    token,
    database,
    schema,
    warehouse,
    authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
    clientSessionKeepAlive: true,
  });

  try {
    const connectAsync = promisifyConnect(connection);
    await connectAsync();

    const executeAsync = promisifyExecute(connection);

    const tableName = "CARE_GAP";
    const fullTableName = `DATA_PRODUCTS.${tableName}`;
    const tableStartTime = Date.now();

    log(`>>> Creating/updating table ${fullTableName} in Snowflake...`);

    const createTableSql = `CREATE TABLE IF NOT EXISTS ${fullTableName} (
      "PATIENT_ID" STRING,
      "MEASURE_NAME" STRING,
      "MEASURE_CODE" STRING,
      "MEASURE_REPORT_CODE" STRING,
      "MEASURE_REPORT_INITIAL_POPULATION" NUMBER,
      "MEASURE_REPORT_EXCLUSION" NUMBER,
      "MEASURE_REPORT_DENOMINATOR" NUMBER,
      "MEASURE_REPORT_NUMERATOR" NUMBER,
      "MEASUREMENT_PERIOD_START" STRING,
      "MEASUREMENT_PERIOD_END" STRING,
      "MEASURE_REPORT" OBJECT,
      "SUPPORTING_EVIDENCE" OBJECT,
      "LAST_RUN" STRING,
      "RUN_ID" STRING
    )`;

    await executeAsync(createTableSql);
    log(`Created/updated table ${fullTableName} in ${elapsedTimeAsStr(tableStartTime)}`);

    const insertStartTime = Date.now();

    const firstRow = rows[0];
    const rowsChunks = chunk(rows, 1000);

    const columns = [
      "PATIENT_ID",
      "MEASURE_NAME",
      "MEASURE_CODE",
      "MEASURE_REPORT_CODE",
      "MEASURE_REPORT_INITIAL_POPULATION",
      "MEASURE_REPORT_EXCLUSION",
      "MEASURE_REPORT_DENOMINATOR",
      "MEASURE_REPORT_NUMERATOR",
      "MEASUREMENT_PERIOD_START",
      "MEASUREMENT_PERIOD_END",
      "MEASURE_REPORT",
      "SUPPORTING_EVIDENCE",
      "LAST_RUN",
      "RUN_ID",
    ];

    let totalInserted = 0;
    let totalSkipped = 0;

    await executeAsynchronously(
      rowsChunks,
      async (rowsChunk: PatientCareGapRow[]): Promise<void> => {
        try {
          const { values, skipped } = getValuesForInsert(rowsChunk, log);
          totalSkipped += skipped.length;

          if (values.length === 0) {
            log(`Skipped entire chunk of ${rowsChunk.length} rows due to validation errors`);
            return;
          }

          const columnSelects = columns.map((col, index) => {
            const value = firstRow[col as keyof PatientCareGapRow];
            const type = getSnowflakeType(value);
            if (type === "OBJECT") {
              return `PARSE_JSON($${index + 1})`;
            }
            return `$${index + 1}`;
          });

          // Properly escape values for SQL
          const escapedValues = values.map(rowVals =>
            rowVals.map(val => `'${escapeForSnowflake(val)}'`).join(",")
          );

          const insertSql = `INSERT INTO ${fullTableName} (${columns
            .map(c => `"${c}"`)
            .join(", ")}) SELECT ${columnSelects.join(", ")} FROM VALUES ${escapedValues
            .map(v => `(${v})`)
            .join(", ")}`;

          await executeAsync(insertSql);

          totalInserted += values.length;
          log(`Inserted ${values.length} rows (${skipped.length} skipped in this chunk)`);
        } catch (error) {
          log(`Error inserting chunk: ${errorToString(error)}`);
          // Log the first row for debugging
          if (rowsChunk.length > 0) {
            log(`First row patient ID: ${rowsChunk[0]?.PATIENT_ID}`);
          }
        }
      },
      {
        numberOfParallelExecutions: numberOfParallelSnowflakeInserts,
      }
    );

    log(
      `Total inserted: ${totalInserted}, total skipped: ${totalSkipped} in ${elapsedTimeAsStr(
        insertStartTime
      )}`
    );
  } finally {
    try {
      const destroyAsync = promisifyDestroy(connection);
      await destroyAsync();
    } catch (error) {
      log(`Error destroying connection: ${errorToString(error)}`);
    }
  }
}

function buildProcessingResults(
  downloadResults: DownloadResults,
  snowflakeSuccess: boolean
): PatientProcessingCareGapResult[] {
  const results: PatientProcessingCareGapResult[] = [];

  for (const pair of downloadResults.success) {
    results.push({
      patientId: pair.patientId,
      measureName: pair.measureName,
      reportKey: pair.reportKey,
      evidenceKey: pair.evidenceKey,
      downloadStatus: "success",
      snowflakeStatus: snowflakeSuccess ? "success" : "error",
    });
  }

  for (const downloadError of downloadResults.error) {
    results.push({
      patientId: downloadError.patientId,
      measureName: downloadError.measureName,
      reportKey: downloadError.reportKey,
      evidenceKey: downloadError.evidenceKey,
      downloadStatus: "error",
      snowflakeStatus: "skipped",
      errorMessage: errorToString(downloadError.error),
    });
  }

  return results;
}

function writeResultsCsv(
  results: PatientProcessingCareGapResult[],
  jobId: string,
  log: typeof console.log
): string {
  const csvHeader =
    "patientId,measureName,reportKey,evidenceKey,downloadStatus,snowflakeStatus,errorMessage";
  const csvRows = results.map(r => {
    const errorMessage = r.errorMessage ? `"${r.errorMessage.replace(/"/g, '""')}"` : "";
    return `${r.patientId},${r.measureName},${r.reportKey},${r.evidenceKey},${r.downloadStatus},${r.snowflakeStatus},${errorMessage}`;
  });
  const csvContent = [csvHeader, ...csvRows].join("\n");

  const csvDir = path.join(folderName, jobId);
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
  }

  const csvPath = path.join(csvDir, "processing-results.csv");
  fs.writeFileSync(csvPath, csvContent, "utf-8");
  log(`>>> Wrote processing results to ${csvPath}`);

  return csvPath;
}

async function displayWarningAndConfirmation(
  jobId: string,
  filePairs: PatientProcessingCareGapFileData[],
  orgName: string,
  log: typeof console.log
): Promise<void> {
  const msg = `You are about to import care gap results for job ${jobId} for customer ${orgName} (${cxId}) into Snowflake DB ${database}. ${filePairs.length} file pairs to process.`;
  log(msg);
  log("Are you sure you want to proceed?");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question("Type 'yes' to proceed: ");
  if (answer !== "yes") {
    log("Aborting...");
    rl.close();
    process.exit(0);
  }
  rl.close();
}

export default program;
