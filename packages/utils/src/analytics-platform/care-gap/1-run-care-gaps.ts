import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { generateHedisJobId } from "@metriport/core/command/analytics-platform/cql-engine/command/cql-transform/cql-transform";
import { S3Utils } from "@metriport/core/external/aws/s3";
import {
  promisifyConnect,
  promisifyDestroy,
  promisifyExecute,
} from "@metriport/core/external/snowflake/commands";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { chunk } from "lodash";
import path from "path";
import readline from "readline/promises";
import * as snowflake from "snowflake-sdk";
import { getAllPatientIds } from "../../patient/get-ids";
import { elapsedTimeAsStr } from "../../shared/duration";
import { buildPathInsideRunsFolder, initRunsFolder } from "../../shared/folder";
import { getCxData } from "../../shared/get-cx-data";
import { getIdsFromFile } from "../../shared/ids";

dayjs.extend(duration);

/**
 * Script to run care gap processing for patients.
 * This script:
 * 1. Queries Snowflake for patient bundles
 * 2. Uploads bundles to S3
 * 3. Triggers CQL transform jobs for care gap processing
 *
 * Usage:
 * - Set env vars in .env file:
 *   - CX_ID (required)
 *   - SNOWFLAKE_ACCOUNT, SNOWFLAKE_TOKEN, SNOWFLAKE_DB, SNOWFLAKE_SCHEMA, SNOWFLAKE_WH
 *   - ANALYTICS_BUCKET_NAME, AWS_REGION, API_URL
 * - Optionally pass patient IDs as comma-separated list, or omit for all patients
 * - Run with: ts-node src/analytics-platform/care-gap/1-run-care-gaps
 *
 * Examples:
 * - ts-node src/analytics-platform/care-gap 1-run-care-gaps
 * - ts-node src/analytics-platform/care-gap 1-run-care-gaps -p "patient1,patient2"
 * - ts-node src/analytics-platform/care-gap 1-run-care-gaps -f "path/to/patient-ids.txt"
 */

const patientIds: string[] = [];

const cxId = getEnvVarOrFail("CX_ID");
const bucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const apiUrl = getEnvVarOrFail("API_URL");
const s3Utils = new S3Utils(region);
const api = axios.create({ baseURL: apiUrl });

const account = getEnvVarOrFail("SNOWFLAKE_ACCOUNT");
const token = getEnvVarOrFail("SNOWFLAKE_TOKEN");
const database = getEnvVarOrFail("SNOWFLAKE_DB");
const schema = getEnvVarOrFail("SNOWFLAKE_SCHEMA");
const warehouse = getEnvVarOrFail("SNOWFLAKE_WH");

const folderName = buildPathInsideRunsFolder(`1-run-care-gaps`);

const numberOfParallelSnowflakeExecutions = 10;
const numberOfParallelS3Uploads = 100;
const numberOfParallelApiCalls = 10;

snowflake.configure({
  ocspFailOpen: false,
  logLevel: "WARN",
  additionalLogToConsole: false,
});

const program = new Command();
program
  .name("1-run-care-gaps")
  .description("CLI to run care gap processing for patients")
  .option("-f, --file <file>", "File containing patient IDs (omit for all patients)")
  .option(
    "--enable-continuous-enrollment",
    "Enable continuous enrollment check (default: disabled)"
  )
  .option("--enable-product-line", "Enable product line check (default: disabled)")
  .option("--enable-benefit", "Enable benefit check (default: disabled)")
  .showHelpAfterError()
  .action(main);

interface PatientBundle {
  patientId: string;
  bundleJson: string | Record<string, unknown>;
}

interface PatientProcessingData {
  patientId: string;
  s3Key: string;
  jobId: string;
  cxId: string;
  error?: unknown;
}

interface PatientProcessingResult extends PatientProcessingData {
  uploadStatus: "success" | "error";
  apiStatus: "success" | "error" | "skipped";
  errorMessage?: string;
}

interface UploadOrApiCallResults {
  total: number;
  success: PatientProcessingData[];
  error: PatientProcessingData[];
}

interface CliOptions {
  file?: string;
  enableContinuousEnrollment?: boolean;
  enableProductLine?: boolean;
  enableBenefit?: boolean;
}

async function main(options: CliOptions) {
  const { file: fileName, enableContinuousEnrollment, enableProductLine, enableBenefit } = options;

  const parameters = {
    disableContinuousEnrollment: !enableContinuousEnrollment,
    disableProductLine: !enableProductLine,
    disableBenefit: !enableBenefit,
  };
  await sleep(50);
  initRunsFolder();
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting at ${buildDayjs().toISOString()}...`);

  if (fileName) {
    if (patientIds.length > 0) {
      log(`>>> Patient IDs provided (${patientIds.length}), skipping file ${fileName}`);
    } else {
      const idsFromFile = getIdsFromFile(fileName);
      if (idsFromFile.length < 1) {
        log(`>>> Empty file ${fileName}`);
        return;
      }
      patientIds.push(...idsFromFile);
      log(`>>> Found ${patientIds.length} patient IDs in ${fileName}`);
    }
  }

  const { orgName } = await getCxData(cxId, undefined, false);

  const jobId = generateHedisJobId();

  const isAllPatients = patientIds.length < 1;
  const patientsToRun = isAllPatients
    ? patientIds.length === 0
      ? await getAllPatientIds({ axios: api, cxId })
      : patientIds
    : patientIds;
  const uniquePatientIds = [...new Set(patientsToRun)];

  await displayWarningAndConfirmation(jobId, uniquePatientIds, isAllPatients, orgName, log);

  const bundles = await queryPatientBundles(uniquePatientIds, log);
  if (bundles.length < 1) {
    log("No patient bundles found. Exiting.");
    return;
  }

  const uploadResults = await uploadBundlesToS3(bundles, jobId, log);
  const apiCallResults = await callCqlTransformEndpoint(
    uploadResults.success,
    jobId,
    parameters,
    log
  );

  const processingResults = buildProcessingResults(uploadResults, apiCallResults);
  const resultsCsvPath = writeResultsCsv(processingResults, jobId, log);

  log(`\n>>>>>>> Completed successfully!`);
  log(`Job ID: ${jobId}`);
  log(`Patients processed: ${bundles.length}`);
  log(`Successful uploads: ${uploadResults.success.length}`);
  log(`Upload errors: ${uploadResults.error.length}`);
  log(`Successful API calls: ${apiCallResults.success.length}`);
  log(`API call errors: ${apiCallResults.error.length}`);
  log(`Results CSV: ${resultsCsvPath}`);

  log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

async function queryPatientBundles(
  patientIds: string[],
  log: typeof console.log
): Promise<PatientBundle[]> {
  if (patientIds.length < 1) return [];
  log(`>>> Querying ${patientIds.length} patient bundles...`);

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

    const patientIdsChunks = chunk(patientIds, 100);

    const allBundles: PatientBundle[] = [];

    const queryStartTime = Date.now();

    await executeAsynchronously(
      patientIdsChunks,
      async (patientIdsChunk: string[]): Promise<void> => {
        try {
          const patientIdList = patientIdsChunk.map(id => `'${id.replace(/'/g, "''")}'`).join(", ");
          const query = `SELECT DISTINCT PATIENT_ID, BUNDLE_JSON FROM CORE.HEDIS__BUNDLE_PATIENT WHERE PATIENT_ID IN (${patientIdList})`;

          log(`>>> Executing Snowflake query...`);
          const { rows } = await executeAsync(query);

          if (!rows || rows.length < 1) return;

          log(`>>> Queried ${rows.length} patient bundles`);

          const bundles = rows.map(row => ({
            patientId: row.PATIENT_ID as string,
            bundleJson: row.BUNDLE_JSON as string | Record<string, unknown>,
          })) as PatientBundle[];
          allBundles.push(...bundles);
        } catch (error) {
          log(`Error querying patient bundles: ${errorToString(error)}`);
        }
      },
      { numberOfParallelExecutions: numberOfParallelSnowflakeExecutions }
    );

    log(`>>> Queried ${allBundles.length} patient bundles in ${elapsedTimeAsStr(queryStartTime)}`);

    return allBundles;
  } finally {
    try {
      const destroyAsync = promisifyDestroy(connection);
      await destroyAsync();
    } catch (error) {
      log("Error destroying connection: ", errorToString(error));
    }
  }
}

function createS3Key(patientId: string, jobId: string): string {
  return `care-gaps/cx=${cxId}/job=${jobId}/snowflake-bundle-export/pt=${patientId}/patient_bundle.json`;
}

async function uploadBundlesToS3(
  bundles: PatientBundle[],
  jobId: string,
  log: typeof console.log
): Promise<UploadOrApiCallResults> {
  const uploadResults: UploadOrApiCallResults = {
    total: bundles.length,
    success: [] as PatientProcessingData[],
    error: [] as PatientProcessingData[],
  };
  if (bundles.length < 1) return uploadResults;
  log(`>>> Uploading ${bundles.length} bundles to S3...`);

  const uploadStartTime = Date.now();

  await executeAsynchronously(
    bundles,
    async (bundle: PatientBundle): Promise<void> => {
      const patientId = bundle.patientId;
      const s3Key = createS3Key(patientId, jobId);
      try {
        let bundleJson: Record<string, unknown>;
        if (typeof bundle.bundleJson === "string") {
          bundleJson = JSON.parse(bundle.bundleJson);
        } else {
          bundleJson = bundle.bundleJson as Record<string, unknown>;
        }

        const bundleBuffer = Buffer.from(JSON.stringify(bundleJson), "utf-8");

        await s3Utils.uploadFile({
          bucket: bucketName,
          key: s3Key,
          file: bundleBuffer,
          contentType: "application/json",
        });

        uploadResults.success.push({
          patientId,
          s3Key,
          jobId,
          cxId,
        });
      } catch (error) {
        log(`Error uploading bundle to S3: ${errorToString(error)}`);
        uploadResults.error.push({
          patientId,
          s3Key,
          jobId,
          cxId,
          error,
        });
      }
    },
    {
      numberOfParallelExecutions: numberOfParallelS3Uploads,
      keepExecutingOnError: true,
    }
  );

  log(
    `Uploaded ${uploadResults.success.length} bundles to S3 (${
      uploadResults.error.length
    } errors) in ${elapsedTimeAsStr(uploadStartTime)}`
  );

  return uploadResults;
}

function createCqlTransformUrl(patientId: string): string {
  return `${apiUrl}/internal/analytics-platform/cql-transform?cxId=${cxId}&patientId=${patientId}`;
}

interface CqlParameters {
  disableContinuousEnrollment: boolean;
  disableProductLine: boolean;
  disableBenefit: boolean;
}

async function callCqlTransformEndpoint(
  patientProcessingData: PatientProcessingData[],
  jobId: string,
  parameters: CqlParameters,
  log: typeof console.log
): Promise<UploadOrApiCallResults> {
  const apiCallResults: UploadOrApiCallResults = {
    total: patientProcessingData.length,
    success: [],
    error: [],
  };
  if (patientProcessingData.length < 1) return apiCallResults;
  log(`>>> Calling CQL transform endpoint for ${patientProcessingData.length} patients...`);

  const apiStartTime = Date.now();

  await executeAsynchronously(
    patientProcessingData,
    async (data: PatientProcessingData) => {
      try {
        const url = createCqlTransformUrl(data.patientId);
        const body = {
          cqlJobId: jobId,
          patientBundleS3Key: data.s3Key,
          parameters,
        };

        await axios.post(url, body);

        apiCallResults.success.push(data);
      } catch (error) {
        log(`Error calling CQL transform endpoint: ${errorToString(error)}`);
        apiCallResults.error.push({ ...data, error });
      }
    },
    {
      numberOfParallelExecutions: numberOfParallelApiCalls,
    }
  );

  log(
    `Called CQL transform endpoint for ${apiCallResults.success.length} patients (${
      apiCallResults.error.length
    } errors) in ${elapsedTimeAsStr(apiStartTime)}`
  );

  return apiCallResults;
}

function buildProcessingResults(
  uploadResults: UploadOrApiCallResults,
  apiCallResults: UploadOrApiCallResults
): PatientProcessingResult[] {
  const results: PatientProcessingResult[] = [];

  for (const upload of uploadResults.success) {
    const apiSuccess = apiCallResults.success.some(api => api.patientId === upload.patientId);
    const apiError = apiCallResults.error.find(api => api.patientId === upload.patientId);

    results.push({
      patientId: upload.patientId,
      s3Key: upload.s3Key,
      jobId: upload.jobId,
      cxId: upload.cxId,
      uploadStatus: "success",
      apiStatus: apiSuccess ? "success" : apiError ? "error" : "skipped",
      errorMessage: apiError ? errorToString(apiError.error) : undefined,
    });
  }

  for (const upload of uploadResults.error) {
    results.push({
      patientId: upload.patientId,
      s3Key: upload.s3Key,
      jobId: upload.jobId,
      cxId: upload.cxId,
      uploadStatus: "error",
      apiStatus: "skipped",
      errorMessage: upload.error ? errorToString(upload.error) : undefined,
    });
  }

  return results;
}

function writeResultsCsv(
  results: PatientProcessingResult[],
  jobId: string,
  log: typeof console.log
): string {
  const csvHeader = "patientId,s3Key,jobId,cxId,uploadStatus,apiStatus,errorMessage";
  const csvRows = results.map(r => {
    const errorMessage = r.errorMessage ? `"${r.errorMessage.replace(/"/g, '""')}"` : "";
    return `${r.patientId},${r.s3Key},${r.jobId},${r.cxId},${r.uploadStatus},${r.apiStatus},${errorMessage}`;
  });
  const csvContent = [csvHeader, ...csvRows].join("\n");

  const csvDir = path.join(folderName, jobId);
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
  }

  const csvPath = path.join(csvDir, "patient-results.csv");
  fs.writeFileSync(csvPath, csvContent, "utf-8");
  log(`>>> Wrote patient results to ${csvPath}`);

  return csvPath;
}

async function displayWarningAndConfirmation(
  jobId: string,
  patientsToRun: string[],
  isAllPatients: boolean,
  orgName: string,
  log: typeof console.log
) {
  const msg =
    `You are about to trigger the care gap processing for ${patientsToRun.length} ${
      isAllPatients ? "all" : "selected"
    } patients of ` +
    `customer ${orgName} (${cxId}) with job ID ${jobId}.\n` +
    `Snowflake DB: ${database}.${schema}`;
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
