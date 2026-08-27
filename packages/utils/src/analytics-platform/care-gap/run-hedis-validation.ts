import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { HedisCliHandler } from "@metriport/core/command/analytics-platform/cql-engine/command/hedis-cli/hedis-cli";
import { buildHedisCliHandler } from "@metriport/core/command/analytics-platform/cql-engine/command/hedis-cli/hedis-cli-factory";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import AdmZip from "adm-zip";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import path from "path";
import readline from "readline/promises";
import { elapsedTimeAsStr } from "../../shared/duration";
import { buildPathInsideRunsFolder, initRunsFolder } from "../../shared/folder";

dayjs.extend(duration);

/**
 * Script to validate HEDIS CQL engine against known test bundles.
 *
 * This script:
 * 1. Loads bundles and expected results from one of several input modes:
 *    - Zip file containing bundles.ndjson and measure_reports.ndjson
 *    - Direct paths to bundles.ndjson and reports.ndjson files
 *    - Single bundle file and single report file
 *    - Resume from existing job ID (skip bundle upload)
 * 2. Uploads each patient bundle to S3 (or uses existing bundles if --job-id provided)
 * 3. Invokes the HEDIS CLI for each patient (auto-detects HTTP for dev, Lambda for prod)
 * 4. Downloads the resulting measure reports from S3
 * 5. Compares actual results against expected results (if provided)
 *
 * Usage with zip file:
 *   ts-node src/analytics-platform/care-gap/run-hedis-validation.ts \
 *     --zip-path ./validation.zip \
 *     --measure BCSE_Details-2025.1.0
 *
 * Usage with NDJSON files:
 *   ts-node src/analytics-platform/care-gap/run-hedis-validation.ts \
 *     --bundles-path ./bundles.ndjson \
 *     --reports-path ./measure_reports.ndjson \
 *     --measure BCSE_Details-2025.1.0
 *
 * Usage with single bundle/report:
 *   ts-node src/analytics-platform/care-gap/run-hedis-validation.ts \
 *     --bundle-path ./patient-bundle.json \
 *     --report-path ./expected-report.json \
 *     --measure BCSE_Details-2025.1.0
 *
 * Resume from existing job:
 *   ts-node src/analytics-platform/care-gap/run-hedis-validation.ts \
 *     --job-id validation-1234567890 \
 *     --reports-path ./measure_reports.ndjson \
 *     --measure BCSE_Details-2025.1.0
 */

const bucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");

const s3Utils = new S3Utils(region);

const folderName = buildPathInsideRunsFolder("run-hedis-validation");

const numberOfParallelS3Uploads = 100;
const defaultCqlEngineConcurrency = process.env.NODE_ENV === "dev" ? 10 : 200;

type ExpectedResult = {
  initialPopulation: boolean;
  numerator: boolean;
  denominator: boolean;
  exclusion: boolean;
};

type ValidationResult = {
  bundleId: string;
  patientId: string;
  expected: ExpectedResult;
  actual: ExpectedResult;
  matches: {
    initialPopulation: boolean;
    numerator: boolean;
    denominator: boolean;
    exclusion: boolean;
  };
  error?: string;
};

type ValidationSummary = {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  initialPopulationMatch: number;
  numeratorMatch: number;
  denominatorMatch: number;
  exclusionMatch: number;
  results: ValidationResult[];
  duration: number;
};

type BundleEntry = {
  bundleId: string;
  patientId: string;
  bundle: Record<string, unknown>;
};

const program = new Command();
program
  .name("run-hedis-validation")
  .description("Run HEDIS CQL engine validation against test bundles")
  // Zip file input mode
  .option("--zip-path <path>", "Local path to validation zip file")
  .option("--s3-zip-path <path>", "S3 key for validation zip file")
  // NDJSON files input mode
  .option("--bundles-path <path>", "Local path to bundles.ndjson file")
  .option("--reports-path <path>", "Local path to measure_reports.ndjson file (optional)")
  // Single file input mode
  .option("--bundle-path <path>", "Local path to a single patient bundle JSON file")
  .option("--report-path <path>", "Local path to a single expected report JSON file (optional)")
  // Resume from existing job
  .option("--job-id <id>", "Resume from an existing job ID (skip bundle upload)")
  // Common options
  .option(
    "--measure <name>",
    "HEDIS measure name (e.g., BCSE_Details-2025.1.0)",
    "BCSE_Details-2025.1.0"
  )
  .option("--max-bundles <n>", "Maximum number of bundles to process", (val: string) =>
    parseInt(val, 10)
  )
  .option("--mode <mode>", "Execution mode: cli or engine", "engine")
  .option(
    "--concurrency <n>",
    "Number of parallel invocations",
    (val: string) => {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? defaultCqlEngineConcurrency : parsed;
    },
    defaultCqlEngineConcurrency
  )
  // CQL parameter overrides (CQL defaults to checks ENABLED; these flags DISABLE them)
  .option(
    "--disable-continuous-enrollment",
    "Disable continuous enrollment check (CQL default: enabled)"
  )
  .option("--disable-product-line", "Disable product line check (CQL default: enabled)")
  .option("--disable-benefit", "Disable benefit check (CQL default: enabled)")
  .showHelpAfterError()
  .action(main);

type CqlParameters = {
  disableContinuousEnrollment?: boolean;
  disableProductLine?: boolean;
  disableBenefit?: boolean;
};

interface CommandOptions {
  // Zip file input
  zipPath?: string;
  s3ZipPath?: string;
  // NDJSON files input
  bundlesPath?: string;
  reportsPath?: string;
  // Single file input
  bundlePath?: string;
  reportPath?: string;
  // Resume from existing job
  jobId?: string;
  // Common options
  measure: string;
  maxBundles?: number;
  mode: "cli" | "engine";
  concurrency: number;
  // CQL parameter overrides (disable checks that are enabled by default in CQL)
  disableContinuousEnrollment?: boolean;
  disableProductLine?: boolean;
  disableBenefit?: boolean;
}

async function main(options: CommandOptions) {
  initRunsFolder();
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting HEDIS Validation at ${buildDayjs().toISOString()}...`);
  log(`>>> Measure: ${options.measure}`);
  log(`>>> Mode: ${options.mode}`);

  // Validate input options - must provide one of the input modes OR a job-id to resume
  const hasZipInput = options.zipPath || options.s3ZipPath;
  const hasNdjsonInput = options.bundlesPath;
  const hasSingleFileInput = options.bundlePath;
  const hasJobId = !!options.jobId;

  if (!hasZipInput && !hasNdjsonInput && !hasSingleFileInput && !hasJobId) {
    throw new Error(
      "Must provide one of: --zip-path/--s3-zip-path, --bundles-path, --bundle-path, or --job-id"
    );
  }

  // Create HEDIS CLI handler using factory (auto-detects HTTP for dev, Lambda for production)
  const hedisCliHandler = buildHedisCliHandler();
  log(`>>> Handler: Factory (auto-detect)`);

  // Build CQL parameters from options
  // Note: In the original CQL, checks are ENABLED by default.
  // When --disable-* flags are passed, we set disable* = TRUE to DISABLE the checks.
  const cqlParameters: CqlParameters = {};
  if (options.disableContinuousEnrollment) {
    cqlParameters.disableContinuousEnrollment = true;
    log(`>>> Parameter: disableContinuousEnrollment = true (check DISABLED)`);
  }
  if (options.disableProductLine) {
    cqlParameters.disableProductLine = true;
    log(`>>> Parameter: disableProductLine = true (check DISABLED)`);
  }
  if (options.disableBenefit) {
    cqlParameters.disableBenefit = true;
    log(`>>> Parameter: disableBenefit = true (check DISABLED)`);
  }

  // Create temp directory for validation files
  const validationDir = path.join(folderName, `validation-${Date.now()}`);
  fs.mkdirSync(validationDir, { recursive: true });

  try {
    let bundles: BundleEntry[];
    let expectedResults: Map<string, ExpectedResult>;
    let uploadResults: UploadResult[];
    let jobId: string;

    // Resume from existing job - skip bundle loading and upload
    if (hasJobId && options.jobId) {
      log("\n>>> Resuming from existing job...");
      jobId = options.jobId;
      log(`>>> Job ID: ${jobId}`);

      // List existing bundles from S3
      log("\n>>> Step 1: Listing existing bundles from S3...");
      uploadResults = await listExistingBundlesFromS3(jobId, options.maxBundles, log);

      // Load expected results if reports path provided
      expectedResults =
        options.reportsPath && fs.existsSync(options.reportsPath)
          ? await loadExpectedResultsFromNdjson(options.reportsPath, log)
          : new Map<string, ExpectedResult>();

      log(`Found ${uploadResults.length} bundles in S3`);
      log(`Loaded ${expectedResults.size} expected results`);

      // Confirm before proceeding
      await displayWarningAndConfirmation(uploadResults.length, options.measure, log);
    } else {
      // Load bundles and expected results based on input mode
      if (hasZipInput) {
        // Mode 1: Zip file input
        log("\n>>> Step 1: Downloading and extracting validation zip...");
        const zipFilePath = path.join(validationDir, "validation.zip");

        if (options.s3ZipPath) {
          await downloadFromS3(options.s3ZipPath, zipFilePath, log);
        } else if (options.zipPath) {
          fs.copyFileSync(options.zipPath, zipFilePath);
        }

        const zip = new AdmZip(zipFilePath);
        zip.extractAllTo(validationDir, true);

        const bundlesPath = path.join(validationDir, "bundles.ndjson");
        const reportsPath = path.join(validationDir, "measure_reports.ndjson");

        if (!fs.existsSync(bundlesPath)) {
          throw new Error(`Required bundles.ndjson not found at ${bundlesPath}`);
        }

        bundles = await loadBundlesFromNdjson(bundlesPath, options.maxBundles, log);
        expectedResults = fs.existsSync(reportsPath)
          ? await loadExpectedResultsFromNdjson(reportsPath, log)
          : new Map<string, ExpectedResult>();
      } else if (hasNdjsonInput && options.bundlesPath) {
        // Mode 2: NDJSON files input
        log("\n>>> Step 1: Loading bundles and expected results from NDJSON files...");

        if (!fs.existsSync(options.bundlesPath)) {
          throw new Error(`Bundles file not found: ${options.bundlesPath}`);
        }

        bundles = await loadBundlesFromNdjson(options.bundlesPath, options.maxBundles, log);
        expectedResults =
          options.reportsPath && fs.existsSync(options.reportsPath)
            ? await loadExpectedResultsFromNdjson(options.reportsPath, log)
            : new Map<string, ExpectedResult>();
      } else if (options.bundlePath) {
        // Mode 3: Single file input
        log("\n>>> Step 1: Loading single bundle and expected result...");

        if (!fs.existsSync(options.bundlePath)) {
          throw new Error(`Bundle file not found: ${options.bundlePath}`);
        }

        bundles = loadSingleBundle(options.bundlePath, log);
        expectedResults =
          options.reportPath && fs.existsSync(options.reportPath)
            ? loadSingleExpectedResult(options.reportPath, log)
            : new Map<string, ExpectedResult>();
      } else {
        throw new Error("No valid input mode specified");
      }

      log(`Loaded ${bundles.length} bundles`);
      log(`Loaded ${expectedResults.size} expected results`);

      // Confirm before proceeding
      await displayWarningAndConfirmation(bundles.length, options.measure, log);

      // Step 3: Upload bundles to S3
      log("\n>>> Step 3: Uploading bundles to S3...");
      jobId = `validation-${Date.now()}`;
      uploadResults = await uploadBundlesToS3(bundles, jobId, log);
    }

    // Step 4: Invoke HEDIS CLI for each patient
    log("\n>>> Step 4: Invoking HEDIS CLI for each patient...");
    const hedisCliResults = await invokeHedisCliForPatients(
      uploadResults,
      jobId,
      options.measure,
      options.mode,
      options.concurrency,
      hedisCliHandler,
      cqlParameters,
      log
    );

    // Step 5: Download reports and compare
    log("\n>>> Step 5: Downloading reports and comparing results...");
    const validationResults = await downloadAndCompareResults(
      hedisCliResults,
      expectedResults,
      jobId,
      options.measure,
      log
    );

    // Step 6: Generate summary
    const summary = generateSummary(validationResults, Date.now() - startedAt);
    printSummary(summary, log);

    // Save results to file
    const resultsPath = path.join(validationDir, "validation-results.json");
    fs.writeFileSync(resultsPath, JSON.stringify(summary, null, 2));
    log(`\nResults saved to: ${resultsPath}`);

    log(`\n>>> Validation completed in ${elapsedTimeAsStr(startedAt)}`);
  } finally {
    // Cleanup
    if (fs.existsSync(validationDir)) {
      fs.rmSync(validationDir, { recursive: true, force: true });
    }
  }
}

async function downloadFromS3(
  s3Key: string,
  localPath: string,
  log: typeof console.log
): Promise<void> {
  log(`Downloading from s3://${bucketName}/${s3Key}...`);
  const buffer = await s3Utils.downloadFile({ bucket: bucketName, key: s3Key });
  fs.writeFileSync(localPath, buffer);
}

async function loadBundlesFromNdjson(
  bundlesPath: string,
  maxBundles: number | undefined,
  log: typeof console.log
): Promise<BundleEntry[]> {
  const bundles: BundleEntry[] = [];

  const fileStream = fs.createReadStream(bundlesPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (maxBundles && bundles.length >= maxBundles) {
      rl.close();
      break;
    }

    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    try {
      const bundle = JSON.parse(trimmedLine);
      const bundleId = bundle.id || `bundle-${bundles.length}`;

      // Extract patient ID from bundle
      const patientEntry = bundle.entry?.find(
        (e: { resource?: { resourceType?: string } }) => e.resource?.resourceType === "Patient"
      );
      const patientId = patientEntry?.resource?.id || bundleId;

      bundles.push({ bundleId, patientId, bundle });
    } catch (error) {
      log(`Error parsing bundle line: ${errorToString(error)}`);
    }
  }

  return bundles;
}

async function loadExpectedResultsFromNdjson(
  reportsPath: string,
  log: typeof console.log
): Promise<Map<string, ExpectedResult>> {
  const results = new Map<string, ExpectedResult>();

  const fileStream = fs.createReadStream(reportsPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    try {
      const report = JSON.parse(trimmedLine);
      if (report.resourceType !== "MeasureReport") continue;

      const subjectRef = report.subject?.reference;
      const bundleId = subjectRef ? subjectRef.replace("Patient/", "") : report.id ?? "";

      const expected: ExpectedResult = {
        initialPopulation: false,
        numerator: false,
        denominator: false,
        exclusion: false,
      };

      if (report.group && Array.isArray(report.group)) {
        for (const group of report.group) {
          if (group.population && Array.isArray(group.population)) {
            for (const pop of group.population) {
              const code = pop.code?.coding?.[0]?.code;
              const count = pop.count ?? 0;

              if (code === "initial-population" && count > 0) expected.initialPopulation = true;
              if (code === "numerator" && count > 0) expected.numerator = true;
              if (code === "denominator" && count > 0) expected.denominator = true;
              if ((code === "denominator-exclusion" || code === "exclusion") && count > 0) {
                expected.exclusion = true;
              }
            }
          }
        }
      }

      if (bundleId) results.set(bundleId, expected);
    } catch (error) {
      log(`Error parsing report line: ${errorToString(error)}`);
    }
  }

  return results;
}

function loadSingleBundle(bundlePath: string, log: typeof console.log): BundleEntry[] {
  const content = fs.readFileSync(bundlePath, "utf-8");
  const bundle = JSON.parse(content);
  const bundleId = bundle.id || path.basename(bundlePath, ".json");

  // Extract patient ID from bundle
  const patientEntry = bundle.entry?.find(
    (e: { resource?: { resourceType?: string } }) => e.resource?.resourceType === "Patient"
  );
  const patientId = patientEntry?.resource?.id || bundleId;

  log(`Loaded single bundle: ${bundleId}`);
  return [{ bundleId, patientId, bundle }];
}

function loadSingleExpectedResult(
  reportPath: string,
  log: typeof console.log
): Map<string, ExpectedResult> {
  const results = new Map<string, ExpectedResult>();

  const content = fs.readFileSync(reportPath, "utf-8");
  const report = JSON.parse(content);

  if (report.resourceType !== "MeasureReport") {
    throw new Error(`Report file is not a MeasureReport resource: ${reportPath}`);
  }

  const subjectRef = report.subject?.reference;
  const bundleId = subjectRef ? subjectRef.replace("Patient/", "") : report.id ?? "";

  if (!bundleId) {
    throw new Error(`Could not determine bundleId from report: ${reportPath}`);
  }

  const expected: ExpectedResult = {
    initialPopulation: false,
    numerator: false,
    denominator: false,
    exclusion: false,
  };

  if (report.group && Array.isArray(report.group)) {
    for (const group of report.group) {
      if (group.population && Array.isArray(group.population)) {
        for (const pop of group.population) {
          const code = pop.code?.coding?.[0]?.code;
          const count = pop.count ?? 0;

          if (code === "initial-population" && count > 0) expected.initialPopulation = true;
          if (code === "numerator" && count > 0) expected.numerator = true;
          if (code === "denominator" && count > 0) expected.denominator = true;
          if ((code === "denominator-exclusion" || code === "exclusion") && count > 0) {
            expected.exclusion = true;
          }
        }
      }
    }
  }

  results.set(bundleId, expected);
  log(`Loaded single expected result for: ${bundleId}`);

  return results;
}

/**
 * Parse actual results from a FHIR MeasureReport or legacy format
 */
function parseActualResultsFromReport(report: Record<string, unknown>): ExpectedResult {
  // Check if it's a FHIR MeasureReport format
  if (report.resourceType === "MeasureReport" && Array.isArray(report.group)) {
    const result: ExpectedResult = {
      initialPopulation: false,
      numerator: false,
      denominator: false,
      exclusion: false,
    };

    for (const group of report.group as Array<{
      population?: Array<{ code?: { coding?: Array<{ code?: string }> }; count?: number }>;
    }>) {
      if (group.population && Array.isArray(group.population)) {
        for (const pop of group.population) {
          const code = pop.code?.coding?.[0]?.code;
          const count = pop.count ?? 0;

          if (code === "initial-population" && count > 0) result.initialPopulation = true;
          if (code === "numerator" && count > 0) result.numerator = true;
          if (code === "denominator" && count > 0) result.denominator = true;
          if ((code === "denominator-exclusion" || code === "exclusion") && count > 0) {
            result.exclusion = true;
          }
        }
      }
    }

    return result;
  }

  // Legacy flat format
  return {
    initialPopulation: (report.initialPopulation as boolean) ?? false,
    numerator: (report.numerator as boolean) ?? false,
    denominator: (report.denominator as boolean) ?? false,
    exclusion: ((report.exclusion ?? report.denominatorExclusion) as boolean) ?? false,
  };
}

type UploadResult = {
  bundleId: string;
  patientId: string;
  s3Key: string;
  success: boolean;
  error?: string;
};

async function uploadBundlesToS3(
  bundles: BundleEntry[],
  jobId: string,
  log: typeof console.log
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  const startTime = Date.now();

  await executeAsynchronously(
    bundles,
    async (bundle: BundleEntry): Promise<void> => {
      const s3Key = `hedis-validation/job=${jobId}/pt=${bundle.patientId}/patient_bundle.json`;

      try {
        await s3Utils.uploadFile({
          bucket: bucketName,
          key: s3Key,
          file: Buffer.from(JSON.stringify(bundle.bundle)),
          contentType: "application/json",
        });

        results.push({
          bundleId: bundle.bundleId,
          patientId: bundle.patientId,
          s3Key,
          success: true,
        });
      } catch (error) {
        const errorMsg = errorToString(error);
        log(`Failed to upload bundle ${bundle.bundleId}: ${errorMsg}`);
        results.push({
          bundleId: bundle.bundleId,
          patientId: bundle.patientId,
          s3Key,
          success: false,
          error: errorMsg,
        });
      }
    },
    { numberOfParallelExecutions: numberOfParallelS3Uploads, keepExecutingOnError: true }
  );

  const successCount = results.filter(r => r.success).length;
  log(`Uploaded ${successCount}/${bundles.length} bundles in ${elapsedTimeAsStr(startTime)}`);

  return results;
}

/**
 * List existing bundles from S3 for a given job ID
 * Used when resuming from an existing job
 */
async function listExistingBundlesFromS3(
  jobId: string,
  maxBundles: number | undefined,
  log: typeof console.log
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  const prefix = `hedis-validation/job=${jobId}/pt=`;
  let continuationToken: string | undefined;

  log(`Listing bundles from s3://${bucketName}/hedis-validation/job=${jobId}/...`);

  do {
    const response = await s3Utils.s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (!obj.Key || !obj.Key.endsWith("patient_bundle.json")) continue;

        // Extract patient ID from key like:
        // hedis-validation/job=validation-123/pt=patient.2025.bcs-e.0.100000/patient_bundle.json
        const match = obj.Key.match(/pt=([^/]+)\//);
        if (!match) continue;

        const patientId = match[1];

        results.push({
          bundleId: patientId,
          patientId,
          s3Key: obj.Key,
          success: true,
        });

        if (maxBundles && results.length >= maxBundles) {
          log(`Reached max bundles limit: ${maxBundles}`);
          return results;
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return results;
}

type HedisCliResult = {
  bundleId: string;
  patientId: string;
  s3Key: string;
  outputS3Key: string;
  success: boolean;
  error?: string;
};

async function invokeHedisCliForPatients(
  uploadResults: UploadResult[],
  jobId: string,
  measureName: string,
  mode: "cli" | "engine",
  concurrency: number,
  hedisCliHandler: HedisCliHandler,
  parameters: CqlParameters,
  log: typeof console.log
): Promise<HedisCliResult[]> {
  const successfulUploads = uploadResults.filter(r => r.success);
  const results: HedisCliResult[] = [];
  const startTime = Date.now();
  let processed = 0;

  await executeAsynchronously(
    successfulUploads,
    async (upload: UploadResult): Promise<void> => {
      const outputS3Path = `hedis-validation/job=${jobId}/results/pt=${upload.patientId}`;

      try {
        await hedisCliHandler.invokeHedisCli({
          patientBundleS3Key: upload.s3Key,
          measureName,
          outputMeasureReportS3Path: outputS3Path,
          mode,
          parameters,
        });

        results.push({
          bundleId: upload.bundleId,
          patientId: upload.patientId,
          s3Key: upload.s3Key,
          outputS3Key: `${outputS3Path}/${measureName}/report.json`,
          success: true,
        });
      } catch (error) {
        results.push({
          bundleId: upload.bundleId,
          patientId: upload.patientId,
          s3Key: upload.s3Key,
          outputS3Key: `${outputS3Path}/${measureName}/report.json`,
          success: false,
          error: errorToString(error),
        });
      }

      processed++;
      if (processed % 100 === 0 || processed === successfulUploads.length) {
        const elapsed = Date.now() - startTime;
        const rate = processed / (elapsed / 1000);
        log(`Processed ${processed}/${successfulUploads.length} (${rate.toFixed(1)}/s)`);
      }
    },
    { numberOfParallelExecutions: concurrency, keepExecutingOnError: true }
  );

  const successCount = results.filter(r => r.success).length;
  log(
    `HEDIS CLI invocations: ${successCount}/${
      successfulUploads.length
    } succeeded in ${elapsedTimeAsStr(startTime)}`
  );

  return results;
}

async function downloadAndCompareResults(
  hedisCliResults: HedisCliResult[],
  expectedResults: Map<string, ExpectedResult>,
  jobId: string,
  measureName: string,
  log: typeof console.log
): Promise<ValidationResult[]> {
  const validationResults: ValidationResult[] = [];
  const successfulResults = hedisCliResults.filter(r => r.success);
  const startTime = Date.now();
  let processed = 0;

  await executeAsynchronously(
    successfulResults,
    async (result: HedisCliResult): Promise<void> => {
      try {
        const buffer = await s3Utils.downloadFile({
          bucket: bucketName,
          key: result.outputS3Key,
        });

        const reportContent = buffer.toString("utf-8");
        const report = JSON.parse(reportContent);

        // Parse actual results from FHIR MeasureReport format
        const actual = parseActualResultsFromReport(report);

        const expected = expectedResults.get(result.bundleId) ?? {
          initialPopulation: false,
          numerator: false,
          denominator: false,
          exclusion: false,
        };

        const matches = {
          initialPopulation: expected.initialPopulation === actual.initialPopulation,
          numerator: expected.numerator === actual.numerator,
          denominator: expected.denominator === actual.denominator,
          exclusion: expected.exclusion === actual.exclusion,
        };

        validationResults.push({
          bundleId: result.bundleId,
          patientId: result.patientId,
          expected,
          actual,
          matches,
        });
      } catch (error) {
        validationResults.push({
          bundleId: result.bundleId,
          patientId: result.patientId,
          expected: expectedResults.get(result.bundleId) ?? {
            initialPopulation: false,
            numerator: false,
            denominator: false,
            exclusion: false,
          },
          actual: {
            initialPopulation: false,
            numerator: false,
            denominator: false,
            exclusion: false,
          },
          matches: {
            initialPopulation: false,
            numerator: false,
            denominator: false,
            exclusion: false,
          },
          error: errorToString(error),
        });
      }

      processed++;
      if (processed % 100 === 0 || processed === successfulResults.length) {
        log(`Downloaded ${processed}/${successfulResults.length} reports`);
      }
    },
    { numberOfParallelExecutions: 50, keepExecutingOnError: true }
  );

  // Add failed CLI invocations as errors
  for (const result of hedisCliResults.filter(r => !r.success)) {
    validationResults.push({
      bundleId: result.bundleId,
      patientId: result.patientId,
      expected: expectedResults.get(result.bundleId) ?? {
        initialPopulation: false,
        numerator: false,
        denominator: false,
        exclusion: false,
      },
      actual: { initialPopulation: false, numerator: false, denominator: false, exclusion: false },
      matches: { initialPopulation: false, numerator: false, denominator: false, exclusion: false },
      error: result.error ?? "Lambda invocation failed",
    });
  }

  log(`Compared ${validationResults.length} results in ${elapsedTimeAsStr(startTime)}`);

  return validationResults;
}

function generateSummary(results: ValidationResult[], durationMs: number): ValidationSummary {
  let passed = 0;
  let failed = 0;
  let errors = 0;
  let ipMatch = 0;
  let numMatch = 0;
  let denomMatch = 0;
  let exclMatch = 0;

  for (const result of results) {
    if (result.error) {
      errors++;
      continue;
    }

    const allMatch = Object.values(result.matches).every(m => m);
    if (allMatch) {
      passed++;
    } else {
      failed++;
    }

    if (result.matches.initialPopulation) ipMatch++;
    if (result.matches.numerator) numMatch++;
    if (result.matches.denominator) denomMatch++;
    if (result.matches.exclusion) exclMatch++;
  }

  return {
    total: results.length,
    passed,
    failed,
    errors,
    initialPopulationMatch: ipMatch,
    numeratorMatch: numMatch,
    denominatorMatch: denomMatch,
    exclusionMatch: exclMatch,
    results,
    duration: durationMs,
  };
}

function printSummary(summary: ValidationSummary, log: typeof console.log): void {
  const total = summary.total;
  if (total < 1) {
    log("No validation results to display - no bundles were validated");
    return;
  }
  function pct(n: number): string {
    return ((n / total) * 100).toFixed(2);
  }

  log("\n==========================================");
  log("Validation Results Summary");
  log("==========================================");
  log(`Total:      ${total}`);
  log(`Passed:     ${summary.passed} (${pct(summary.passed)}%)`);
  log(`Failed:     ${summary.failed} (${pct(summary.failed)}%)`);
  log(`Errors:     ${summary.errors}`);
  log("");
  log("Match rates:");
  log(
    `  Initial Pop: ${summary.initialPopulationMatch}/${total} (${pct(
      summary.initialPopulationMatch
    )}%)`
  );
  log(`  Numerator:   ${summary.numeratorMatch}/${total} (${pct(summary.numeratorMatch)}%)`);
  log(`  Denominator: ${summary.denominatorMatch}/${total} (${pct(summary.denominatorMatch)}%)`);
  log(`  Exclusion:   ${summary.exclusionMatch}/${total} (${pct(summary.exclusionMatch)}%)`);
  log("");
  const durationSecs = summary.duration / 1000;
  const durationMins = durationSecs / 60;
  log(`Duration: ${durationSecs.toFixed(2)}s / ${durationMins.toFixed(2)}min`);
  log("==========================================");

  // Show first failures
  const failures = summary.results.filter(r => !Object.values(r.matches).every(m => m) && !r.error);
  if (failures.length > 0) {
    log("\nFirst 10 failures:");
    for (const f of failures.slice(0, 10)) {
      const failedFields = Object.entries(f.matches)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      log(
        `  ${f.bundleId}: IP(exp=${f.expected.initialPopulation}, act=${
          f.actual.initialPopulation
        }) [${failedFields.join(", ")}]`
      );
    }
  }
}

async function displayWarningAndConfirmation(
  bundleCount: number,
  measureName: string,
  log: typeof console.log
): Promise<void> {
  log(`\nYou are about to validate ${bundleCount} patient bundles against measure ${measureName}.`);
  log("This will invoke the HEDIS CLI Lambda for each patient.");
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

// Only parse when running directly, not when imported as a module
if (require.main === module) {
  program.parse();
}

export default program;
