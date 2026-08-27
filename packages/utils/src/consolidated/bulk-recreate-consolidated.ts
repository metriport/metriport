import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { PatientDTO } from "@metriport/api-sdk";
import { ConsolidatedSnapshotRequestSync } from "@metriport/core/command/consolidated/get-snapshot";
import { getDomainFromDTO } from "@metriport/core/command/patient-loader-metriport-api";
import { SQSClient } from "@metriport/core/external/aws/sqs";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getFileContents } from "@metriport/core/util/fs";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVar, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import readline from "readline/promises";
import { getPatientIds } from "../patient/get-ids";
import { elapsedTimeAsStr, getDelayTime } from "../shared/duration";
import { initFile } from "../shared/file";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";
import { getCxData } from "../shared/get-cx-data";
import { logErrorToFile } from "../shared/log";

dayjs.extend(duration);

/**
 * This script triggers the recreation of consolidated data for multiple patients.
 * It makes parallel requests to the API to recreate consolidated data for each patient.
 *
 * IMPORTANT: while the endpoint doesn't seem to do much work with shared resources (mostly S3 and
 * lambda), when consolidated get re-created we re-ingest the patient's data into OpenSearch (OS).
 * Be mindful about that, so we likely don't want to get the delay/sleep under 1 second.
 *
 * Update the `patientIds` array with the list of Patient IDs you want to recreate consolidated data for.
 * If the array is empty, it will process ALL patients for the customer.
 * Alternatively, you can provide a file with patient IDs, one per line.
 *
 * NOTE:
 * - by default it will use cached AI Briefs. To use non-cached AI Briefs, use the --no-cached flag.
 * - currently requires --use-api (queue-based run disabled). TODO ENG-1975: revert to allow and default to queue.
 *
 * Successfully processed patient IDs are saved in a file in the `runs/recreate-consolidated` folder,
 * named with the customer's name and timestamp, e.g.,:
 * $ packages/utils/runs/recreate-consolidated/<cx-name>_2025-06-19T06:56:19.714Z.success.patientIds.txt
 *
 * Any errors encountered during processing are saved in two files in the `runs/recreate-consolidated` folder,
 * named with the customer's name and timestamp, e.g.,:
 * $ packages/utils/runs/recreate-consolidated/<cx-name>_2025-06-19T06:56:19.714Z.error.patientIds.txt
 * $ packages/utils/runs/recreate-consolidated/<cx-name>_2025-06-19T06:56:19.714Z.error.txt (detailed error)
 *
 * The delay time between requests is managed by the `getDelayTime` function, which
 * ensures we don't overwhelm the system while maintaining good throughput.
 *
 * Execute this with:
 * $ ts-node src/consolidated/bulk-recreate-consolidated.ts
 */

// Add patient IDs here to kick off queries for specific patient IDs
const patientIds: string[] = [];
// Alternatively, you can provide a file with patient IDs, one per line
const fileName = "";

const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const api = axios.create({ baseURL: apiUrl });

// Only required when enqueuing (currently disabled, see TODO ENG-1975)
const queueUrl = getEnvVar("FHIR_TO_BUNDLE_QUEUED_QUEUE_URL");
const region = getEnvVar("AWS_REGION");
const sqsClient = region ? new SQSClient({ region }) : undefined;

// query stuff
const minimumDelayTime = dayjs.duration(500, "milliseconds");
const defaultDelayTime = dayjs.duration(2, "seconds");

const numberOfParallelExecutions = 30;

// output stuff
const getOutputFileName = buildGetDirPathInside(`recreate-consolidated`);
const patientsWithErrors: string[] = [];

type ModeConfig = {
  modeLabel: string;
  actionVerb: string;
  progressVerb: string;
  confirmationAction: string;
  parallelExecutions: number;
  maxJitterMillis: number;
};

const apiModeConfig: ModeConfig = {
  modeLabel: "API calls ⚠️",
  actionVerb: "recreating",
  progressVerb: "complete",
  confirmationAction: "recreate via API",
  parallelExecutions: numberOfParallelExecutions,
  maxJitterMillis: 100,
};

const enqueueModeConfig: ModeConfig = {
  modeLabel: `ENQUEUE to SQS (${queueUrl}) 👍`,
  actionVerb: "enqueueing",
  progressVerb: "enqueued",
  confirmationAction: "enqueue to SQS",
  parallelExecutions: 50,
  maxJitterMillis: 50,
};

const program = new Command();
program
  .name("recreate-consolidated")
  .description("CLI to recreate consolidated data for multiple patients.")
  .option("--cached", "Use cached AI Brief (default)")
  .option("--no-cached", "Do not use cached AI Brief")
  .option("--use-api", "Use API calls (required for now)")
  .showHelpAfterError()
  .action(main)
  .parse();

async function main({ cached = true, useApi = false }: { cached?: boolean; useApi?: boolean }) {
  initRunsFolder();
  const { log } = out("");
  log(`############# Starting at ${buildDayjs().toISOString()}`);

  // TODO ENG-1975: remove this requirement and revert to allow and default to queue-based run
  if (!useApi) {
    log(">>> ERROR: --use-api is required for now. Run with --use-api flag.");
    process.exit(1);
  }

  const enqueue = !useApi;
  if (enqueue && (!queueUrl || !sqsClient)) {
    log(
      ">>> ERROR: requires FHIR_TO_BUNDLE_QUEUED_QUEUE_URL and AWS_REGION env vars when using queues"
    );
    process.exit(1);
  }

  const config = enqueue ? enqueueModeConfig : apiModeConfig;
  log(`>>> Mode: ${config.modeLabel}`);

  if (fileName) {
    if (patientIds.length > 0) {
      log(`>>> Patient IDs provided (${patientIds.length}), skipping file ${fileName}`);
    } else {
      const fileContents = getFileContents(fileName);
      const idsFromFile = fileContents
        .split(/\r?\n/)
        .map(id => id.replaceAll('"', "").replaceAll("'", "").trim())
        .filter(id => id.length > 0 && id.toLowerCase() !== "id");
      patientIds.push(...idsFromFile);
      if (patientIds.length < 1) {
        log(`>>> Empty file ${fileName} - will process ALL patients for the customer`);
      } else {
        log(`>>> Found ${patientIds.length} patient IDs in ${fileName}`);
      }
    }
  }

  const startedAt = Date.now();
  const isAllPatientsMode = patientIds.length === 0;
  if (isAllPatientsMode) {
    log(`>>> No patient IDs provided - will process ALL patients for the customer...`);
  } else {
    log(`>>> Starting with ${patientIds.length} patient IDs...`);
  }

  const { orgName } = await getCxData(cxId, undefined, false);
  const { patientIds: patientIdsToProcess, isAllPatients } = await getPatientIds({
    cxId,
    patientIds,
    axios: api,
  });

  await displayWarningAndConfirmation(
    patientIdsToProcess.length,
    orgName,
    cached,
    config,
    isAllPatients,
    log
  );

  const errorFileName = getOutputFileName(orgName) + ".error";
  initFile(errorFileName);
  const successFileName = getOutputFileName(orgName) + ".success";
  initFile(successFileName);

  log(`>>> Running it...`);

  let ptIndex = 0;
  await executeAsynchronously(
    patientIdsToProcess,
    async patientId => {
      await recreateConsolidatedForPatient(
        patientId,
        cxId,
        successFileName,
        errorFileName,
        cached,
        enqueue,
        log
      );
      log(
        `>>> Progress: ${++ptIndex}/${patientIdsToProcess.length} patients ${config.progressVerb}`
      );
      const delayTime = getDelayTime({ log, minimumDelayTime, defaultDelayTime });
      log(`...sleeping for ${delayTime} ms`);
      await sleep(delayTime);
    },
    {
      numberOfParallelExecutions: config.parallelExecutions,
      minJitterMillis: 5,
      maxJitterMillis: config.maxJitterMillis,
    }
  );
  if (patientsWithErrors.length > 0) {
    log(
      `>>> Patients with errors (${patientsWithErrors.length}): ${patientsWithErrors.join(", ")}`
    );
    log(`>>> See file ${errorFileName} for more details.`);
  } else {
    log(`>>> No patient with errors!`);
  }
  log(
    `############# Done ${config.actionVerb} consolidated for all ${
      patientIdsToProcess.length
    } patients in ${elapsedTimeAsStr(startedAt)}`
  );
  process.exit(0);
}

async function displayWarningAndConfirmation(
  patientCount: number | undefined,
  orgName: string,
  useCachedAiBrief: boolean,
  config: ModeConfig,
  isAllPatients: boolean,
  log: typeof console.log
) {
  const useCachedAiBriefStr = useCachedAiBrief
    ? "with cached AI Summaries."
    : "WITHOUT cached AI Summaries - THIS CAN BE VERY EXPENSIVE!!!";
  const msg = isAllPatients
    ? `You are about to ${config.confirmationAction} consolidated data for ALL patients of the org/cx ${orgName} ${useCachedAiBriefStr}`
    : `You are about to ${config.confirmationAction} consolidated data for ${patientCount} patients of the org/cx ${orgName} ${useCachedAiBriefStr}`;
  log(msg);
  console.log("Are you sure you want to proceed?");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const expectedAnswer = useCachedAiBrief ? "yes" : "YES no cache";
  const answer = await rl.question(`Type '${expectedAnswer}' to proceed: `);
  if (answer !== expectedAnswer) {
    console.log("Aborting...");
    process.exit(0);
  }
  rl.close();
}

async function recreateConsolidatedForPatient(
  patientId: string,
  cxId: string,
  successFileName: string,
  errorFileName: string,
  useCachedAiBrief: boolean,
  enqueue: boolean,
  log: typeof console.log
) {
  try {
    if (enqueue && sqsClient && queueUrl) {
      await enqueueToSqs(patientId, cxId, useCachedAiBrief);
      log(`>>> Enqueued consolidated for patient ${patientId}`);
    } else {
      const params = new URLSearchParams({ cxId, useCachedAiBrief: useCachedAiBrief.toString() });
      await api.post(`/internal/patient/${patientId}/consolidated/refresh?${params.toString()}`);
      log(`>>> Done recreate consolidated for patient ${patientId}...`);
    }
    fs.appendFileSync(successFileName + ".patientIds.txt", `${patientId}\n`);
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error) {
    const msg = `ERROR processing patient ${patientId}: `;
    log(`${msg}${errorToString(error)}`);
    patientsWithErrors.push(patientId);
    logErrorToFile(errorFileName, msg, error as Error);
    fs.appendFileSync(errorFileName + ".patientIds.txt", `${patientId}\n`);
  }
}

async function enqueueToSqs(
  patientId: string,
  cxId: string,
  useCachedAiBrief: boolean
): Promise<void> {
  if (!sqsClient || !queueUrl) throw new Error("SQS client not initialized");

  const queryParams = new URLSearchParams({ cxId });
  const patientUrl = `/internal/patient/${patientId}?${queryParams.toString()}`;
  const response = await api.get(patientUrl);
  const patientDto = response.data as PatientDTO;
  if (!patientDto) throw new Error(`Patient not found: ${patientId}`);

  const patient = getDomainFromDTO(patientDto, cxId);
  const payload: ConsolidatedSnapshotRequestSync = {
    patient,
    isAsync: false,
    sendAnalytics: true,
    useCachedAiBrief,
  };

  const payloadStr = JSON.stringify(payload);
  await sqsClient.sendMessageToQueue(queueUrl, payloadStr, {
    fifo: true,
    messageGroupId: patientId,
    messageDeduplicationId: createUuidFromText(payloadStr),
  });
}

export default program;
