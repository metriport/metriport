import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { PatientDTO } from "@metriport/api-sdk";
import { createConsolidatedFromConversions } from "@metriport/core/command/consolidated/consolidated-create";
import { getDomainFromDTO } from "@metriport/core/command/patient-loader-metriport-api";
import { ConsolidatedLinkDemographics, Patient } from "@metriport/core/domain/patient";
import {
  FeatureFlags,
  FeatureFlagsRecord,
} from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { FeatureFlagDatastore } from "@metriport/core/command/feature-flags/types";
import { Config } from "@metriport/core/util/config";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import { Command } from "commander";
import readline from "readline/promises";
import { elapsedTimeAsStr } from "../shared/duration";
import { getCxData } from "../shared/get-cx-data";

/**
 * Recreates a consolidated FHIR bundle for a patient locally, useful for testing and debugging
 * changes to consolidated bundle creation logic without triggering the full production pipeline.
 *
 * Use this script when:
 * - Testing changes to patient demographics enrichment or consolidated bundle logic
 * - Debugging issues with a specific patient's consolidated bundle
 * - Verifying that consolidated bundles are generated correctly after code changes
 * - Comparing bundle output before and after modifications
 *
 * The script fetches patient data from the API, applies the same consolidation logic used in
 * production, and writes the result to S3, allowing you to inspect and validate the output.
 *
 * Required command-line arguments:
 * - --cxId, -c: Customer ID
 * - --patientId, -p: Patient ID
 * - --destinationBucket: Destination S3 bucket name
 * - --sourceBucket: Source S3 bucket name
 *
 * Optional command-line arguments:
 * - --useCachedAiBrief: Boolean flag for using cached AI brief (defaults to true)
 *
 * Environment variables required:
 * - API_URL: Base URL for the API
 *
 * Execute this with:
 * $ ts-node src/consolidated/recreate-consolidated-local.ts \
 *   --cxId <customer-id> \
 *   --patientId <patient-id> \
 *   --destinationBucket <destination-bucket-name> \
 *   --sourceBucket <source-bucket-name> \
 *   [--useCachedAiBrief true]
 */

const program = new Command();

program
  .name("recreate-consolidated-local")
  .description("Retrieves patient from database and creates consolidated bundle locally")
  .requiredOption("-c, --cxId <cxId>", "Customer ID")
  .requiredOption("-p, --patientId <patientId>", "Patient ID")
  .requiredOption("--destinationBucket <destinationBucket>", "Destination S3 bucket name")
  .requiredOption("--sourceBucket <sourceBucket>", "Source S3 bucket name")
  .option(
    "--useCachedAiBrief <useCachedAiBrief>",
    "Use cached AI brief (defaults to true)",
    (value: string) => {
      if (value === undefined || value === "") return true;
      const lowerValue = value.toLowerCase();
      if (lowerValue === "true" || lowerValue === "1" || lowerValue === "yes") return true;
      if (lowerValue === "false" || lowerValue === "0" || lowerValue === "no") return false;
      throw new Error(`Invalid boolean value: ${value}. Expected true/false, 1/0, or yes/no`);
    },
    true
  )
  .showHelpAfterError();

// Initialize FeatureFlags - will be synced with API data in main()
FeatureFlags.init(Config.getAWSRegion(), Config.getFeatureFlagsTableName());

type Checkpoint = {
  name: string;
  timestamp: number;
  duration?: number;
};

function formatDuration(millis: number): string {
  const seconds = (millis / 1000).toFixed(2);
  const minutes = (millis / 60000).toFixed(2);
  return `${millis.toLocaleString()} ms (${seconds}s / ${minutes}min)`;
}

function printPerformanceTable(checkpoints: Checkpoint[], totalTime: number, excludedTime = 0) {
  console.log("\n" + "=".repeat(80));
  console.log("PERFORMANCE SUMMARY");
  console.log("=".repeat(80));
  console.log(`${"Checkpoint".padEnd(40)} ${"Duration".padStart(40)}`);
  console.log("-".repeat(80));

  let previousTimestamp = checkpoints[0]?.timestamp ?? 0;
  for (const checkpoint of checkpoints) {
    const duration = checkpoint.duration ?? checkpoint.timestamp - previousTimestamp;
    const durationStr = formatDuration(duration);
    const marker = checkpoint.name === "User confirmation" ? " (excluded)" : "";
    console.log(`${(checkpoint.name + marker).padEnd(40)} ${durationStr.padStart(40)}`);
    previousTimestamp = checkpoint.timestamp;
  }

  console.log("-".repeat(80));
  const activeTime = totalTime - excludedTime;
  console.log(
    `${"TOTAL (excluding user confirmation)".padEnd(40)} ${formatDuration(activeTime).padStart(40)}`
  );
  console.log(
    `${"TOTAL (including user confirmation)".padEnd(40)} ${formatDuration(totalTime).padStart(40)}`
  );
  console.log("=".repeat(80) + "\n");
}

async function main() {
  const startedAt = Date.now();
  const { log } = out("recreate-consolidated-local");
  const checkpoints: Checkpoint[] = [{ name: "Script start", timestamp: startedAt }];
  console.log(`############## Started at ${buildDayjs().toISOString()} ##############`);

  try {
    program.parse();
    const options = program.opts<{
      cxId: string;
      patientId: string;
      destinationBucket: string;
      sourceBucket: string;
      useCachedAiBrief: boolean;
    }>();
    checkpoints.push({ name: "Parse arguments", timestamp: Date.now() });

    const { cxId, patientId, destinationBucket, sourceBucket, useCachedAiBrief } = options;

    logInitialConfiguration({
      cxId,
      patientId,
      destinationBucket,
      sourceBucket,
      useCachedAiBrief,
      log,
    });

    const api = setupApiClient(log);
    const queryParams = new URLSearchParams({ cxId });

    await syncFeatureFlagsFromApi(api, checkpoints, log);

    const patientDto = await fetchPatientFromApi(api, patientId, queryParams, checkpoints, log);

    const consolidatedLinkDemographics = await fetchConsolidatedLinkDemographics(
      api,
      patientId,
      queryParams,
      checkpoints,
      log
    );

    const patient = buildPatientDomainObject(
      patientDto,
      cxId,
      consolidatedLinkDemographics,
      checkpoints
    );

    const { orgName } = await getCxData(cxId, undefined, false);
    checkpoints.push({ name: "Get customer data", timestamp: Date.now() });

    await verifyFeatureFlags(cxId, checkpoints, log);

    const confirmationDuration = await getUserConfirmation({
      cxId,
      patientId,
      orgName,
      destinationBucket,
      sourceBucket,
      log,
      checkpoints,
    });

    const bundle = await createConsolidatedBundle({
      cxId,
      patient,
      destinationBucket,
      sourceBucket,
      useCachedAiBrief,
      checkpoints,
    });

    logSuccessAndPerformance({
      bundle,
      checkpoints,
      startedAt,
      confirmationDuration,
    });

    process.exit(0);
  } catch (error) {
    handleError({ error, checkpoints, startedAt, log });
    process.exit(1);
  }
}

function logInitialConfiguration({
  cxId,
  patientId,
  destinationBucket,
  sourceBucket,
  useCachedAiBrief,
  log,
}: {
  cxId: string;
  patientId: string;
  destinationBucket: string;
  sourceBucket: string;
  useCachedAiBrief: boolean;
  log: typeof console.log;
}): void {
  const msg =
    `Starting consolidated creation for:\n` +
    `  PATIENT \t\t-- ${patientId}\n` +
    `  CUSTOMER \t\t-- ${cxId}\n` +
    `  SOURCE BUCKET \t-- ${sourceBucket}\n` +
    `  DESTINATION BUCKET \t-- ${destinationBucket}`;
  log(msg);
  log(`Use cached AI brief: ${useCachedAiBrief}`);
}

function setupApiClient(log: typeof console.log): ReturnType<typeof axios.create> {
  const apiUrl = getEnvVarOrFail("API_URL");
  log(`API URL: ${apiUrl}`);
  return axios.create({ baseURL: apiUrl });
}

async function syncFeatureFlagsFromApi(
  api: ReturnType<typeof axios.create>,
  checkpoints: Checkpoint[],
  log: typeof console.log
): Promise<void> {
  log(`Syncing feature flags from API...`);
  try {
    const ffResponse = await api.get("/internal/feature-flags");
    const ffRecord = ffResponse.data as FeatureFlagsRecord;
    if (ffRecord) {
      await FeatureFlags.syncCache(ffRecord);
      log(`Feature flags synced successfully from API`);
    } else {
      log(`Warning: No feature flags record returned from API`);
    }
    checkpoints.push({ name: "Sync feature flags from API", timestamp: Date.now() });
  } catch (error) {
    const errorMsg = `Failed to sync feature flags from API: ${errorToString(error)}`;
    log(errorMsg);
    throw new Error(errorMsg, { cause: error });
  }
}

async function fetchPatientFromApi(
  api: ReturnType<typeof axios.create>,
  patientId: string,
  queryParams: URLSearchParams,
  checkpoints: Checkpoint[],
  log: typeof console.log
): Promise<PatientDTO> {
  log(`Retrieving patient from API...`);
  try {
    const patientUrl = `/internal/patient/${patientId}?${queryParams.toString()}`;
    const response = await api.get(patientUrl);
    const patientDto = response.data as PatientDTO;
    if (!patientDto) {
      throw new Error(`Patient not found: ${patientId}`);
    }
    log(`Patient retrieved successfully: ${patientDto.id}`);
    checkpoints.push({ name: "Fetch patient from API", timestamp: Date.now() });
    return patientDto;
  } catch (error) {
    const errorMsg = `Failed to retrieve patient from API: ${errorToString(error)}`;
    throw new Error(errorMsg, { cause: error });
  }
}

async function fetchConsolidatedLinkDemographics(
  api: ReturnType<typeof axios.create>,
  patientId: string,
  queryParams: URLSearchParams,
  checkpoints: Checkpoint[],
  log: typeof console.log
): Promise<ConsolidatedLinkDemographics | null> {
  try {
    const demographicsUrl = `/internal/patient/${patientId}/consolidated-link-demographics?${queryParams.toString()}`;
    const demographicsResponse = await api.get(demographicsUrl);
    const consolidatedLinkDemographics =
      demographicsResponse.data as ConsolidatedLinkDemographics | null;
    log(`Consolidated link demographics retrieved successfully`);
    checkpoints.push({ name: "Fetch consolidated link demographics", timestamp: Date.now() });
    return consolidatedLinkDemographics;
  } catch (error) {
    const errorMsg = `Failed to retrieve consolidated link demographics from API: ${errorToString(
      error
    )}`;
    throw new Error(errorMsg, { cause: error });
  }
}

function buildPatientDomainObject(
  patientDto: PatientDTO,
  cxId: string,
  consolidatedLinkDemographics: ConsolidatedLinkDemographics | null,
  checkpoints: Checkpoint[]
): Patient {
  const patient: Patient = getDomainFromDTO(patientDto, cxId);
  if (consolidatedLinkDemographics) {
    patient.data.consolidatedLinkDemographics = consolidatedLinkDemographics;
  }
  checkpoints.push({ name: "Convert DTO to domain object", timestamp: Date.now() });
  return patient;
}

async function verifyFeatureFlags(
  cxId: string,
  checkpoints: Checkpoint[],
  log: typeof console.log
): Promise<void> {
  log(`Verifying feature flags from synced cache...`);
  try {
    const ffRecord = await FeatureFlags.getFeatureFlagsRecord({ skipCache: false });
    const featureFlags: FeatureFlagDatastore =
      ffRecord?.featureFlags ?? ({} as FeatureFlagDatastore);

    const aiBriefFF = featureFlags.cxsWithAiBriefFeatureFlag;
    const aiBriefV2FF = featureFlags.cxsWithAiBriefV2FeatureFlag;
    const enrichedDemographicsFF = featureFlags.cxsWithEnrichedPatientDemographicsFeatureFlag;

    const aiBriefEnabled = aiBriefFF?.values?.includes(cxId) ?? false;
    const aiBriefV2Enabled = aiBriefV2FF?.values?.includes(cxId) ?? false;
    const enrichedDemographicsEnabled = enrichedDemographicsFF?.values?.includes(cxId) ?? false;

    const msg =
      `Feature flags state:\n` +
      `  FEATURE FLAG NAME \t\t\t\t\t-- CX ENABLED\n` +
      `  ${"-".repeat(60)}\n` +
      `  cxsWithAiBriefFeatureFlag \t\t\t\t-- ${aiBriefEnabled}\n` +
      `  cxsWithAiBriefV2FeatureFlag \t\t\t\t-- ${aiBriefV2Enabled}\n` +
      `  cxsWithEnrichedPatientDemographicsFeatureFlag \t-- ${enrichedDemographicsEnabled}`;
    log(msg);
    checkpoints.push({ name: "Verify feature flags", timestamp: Date.now() });
  } catch (error) {
    const errorMsg = `Failed to verify feature flags: ${errorToString(error)}`;
    throw new Error(errorMsg, { cause: error });
  }
}

async function getUserConfirmation({
  cxId,
  patientId,
  orgName,
  destinationBucket,
  sourceBucket,
  log,
  checkpoints,
}: {
  cxId: string;
  patientId: string;
  orgName: string;
  destinationBucket: string;
  sourceBucket: string;
  log: typeof console.log;
  checkpoints: Checkpoint[];
}): Promise<number> {
  const confirmationStart = Date.now();
  await displayWarningAndConfirmation({
    cxId,
    patientId,
    orgName,
    destinationBucket,
    sourceBucket,
    log,
  });
  const confirmationEnd = Date.now();
  const confirmationDuration = confirmationEnd - confirmationStart;
  checkpoints.push({
    name: "User confirmation",
    timestamp: confirmationEnd,
    duration: confirmationDuration,
  });
  return confirmationDuration;
}

async function createConsolidatedBundle({
  cxId,
  patient,
  destinationBucket,
  sourceBucket,
  useCachedAiBrief,
  checkpoints,
}: {
  cxId: string;
  patient: Patient;
  destinationBucket: string;
  sourceBucket: string;
  useCachedAiBrief: boolean;
  checkpoints: Checkpoint[];
}): Promise<Bundle> {
  const { log } = out("recreate-consolidated-local");
  log(`Creating consolidated bundle...`);
  const bundle = await createConsolidatedFromConversions({
    cxId,
    patient,
    destinationBucketName: destinationBucket,
    sourceBucketName: sourceBucket,
    useCachedAiBrief,
  });
  checkpoints.push({ name: "Create consolidated bundle", timestamp: Date.now() });
  return bundle;
}

function logSuccessAndPerformance({
  bundle,
  checkpoints,
  startedAt,
  confirmationDuration,
}: {
  bundle: Bundle;
  checkpoints: Checkpoint[];
  startedAt: number;
  confirmationDuration: number;
}): void {
  const { log } = out("recreate-consolidated-local");
  log(`Consolidated bundle created successfully`);
  log(`Bundle contains ${bundle.entry?.length ?? 0} entries`);
  log(`Bundle total: ${bundle.total ?? 0}`);

  const totalTime = Date.now() - startedAt;
  printPerformanceTable(checkpoints, totalTime, confirmationDuration);
  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

function handleError({
  error,
  checkpoints,
  startedAt,
  log,
}: {
  error: unknown;
  checkpoints: Checkpoint[];
  startedAt: number;
  log: typeof console.log;
}): void {
  const errorMsg = `Error creating consolidated bundle: ${errorToString(error)}`;
  log(errorMsg);
  const totalTime = Date.now() - startedAt;
  const confirmationDuration =
    checkpoints.find(cp => cp.name === "User confirmation")?.duration ?? 0;
  if (checkpoints.length > 0) {
    printPerformanceTable(checkpoints, totalTime, confirmationDuration);
  }
  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

async function displayWarningAndConfirmation({
  cxId,
  patientId,
  orgName,
  destinationBucket,
  sourceBucket,
  log,
}: {
  cxId: string;
  patientId: string;
  orgName: string;
  destinationBucket: string;
  sourceBucket: string;
  log: typeof console.log;
}) {
  const destination = destinationBucket;
  const source = sourceBucket;
  const msg =
    `You are about to recreate consolidated bundle for:\n` +
    `  PATIENT \t\t-- ${patientId}\n` +
    `  CUSTOMER \t\t-- ${orgName} (${cxId})\n` +
    `  SOURCE BUCKET \t-- ${source}\n` +
    `  DESTINATION BUCKET \t-- ${destination}`;
  log(msg);
  log("Are you sure you want to proceed?");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question("Type 'yes' to proceed: ");
  rl.close();
  if (answer !== "yes") {
    log("Aborting...");
    process.exit(0);
  }
}

main();
