import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk/medical/client/metriport";
import { PatientState } from "@metriport/core/command/patient-state/types";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { errorToString, executeWithNetworkRetries, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios, { AxiosError } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { chunk } from "lodash";
import { confirm } from "../shared/confirm";
import { elapsedTimeAsStr } from "../shared/duration";
import { initFile } from "../shared/file";
import { shouldStopScript } from "../shared/flow";
import { buildPathInsideRunsFolder } from "../shared/folder";
import { getIdsFromFile } from "../shared/ids";

/**
 * This script triggers Ehex patient discovery with scheduled DQ for the given patients.
 * Alternatively, it can skip PD and only trigger DQ (set isSkipPd to true).
 *
 * Processes patients in small batches and only schedules the next batch when the
 * current batch has finished processing (pd/dq/dr complete; considering conversion or not).
 *
 * NOTE: if running a large amount of patients in regular load times, keep the batch size
 * as small as possible (1-2), to avoid impacting customers running the platform.
 *
 * To run:
 * 1. Set the env vars:
 *  - CX_ID
 *  - API_URL_LB
 *  - API_URL - optional, if need to track FHIR resource count before and after
 *  - API_KEY - optional, if need to track FHIR resource count before and after
 * 2. Set the patientIds array below, or provide a fileName with patient IDs (one per line).
 * 3. Set the following flags:
 *  - isScheduledDq - whether to trigger a document query after patient discovery
 *  - isSkipPd - whether to skip patient discovery and only trigger document query
 *  - forceDownload - whether to force document download
 *  - overrideIsTargetedQueryEnabled - whether to force targeted queries
 *  - overrideDemoAugEnabled - whether to override the demo augmentation feature flag
 *  - isUseAugmentedDemoOnFirstRun - whether to use augmented demographics on the first run of patient discovery.
 *      patient discovery. This was found to be the optimal approach for now.
 *  - countResourcesBeforeAndAfter - whether to count the resources before and after the data pipeline
 * 4. Run: npx ts-node packages/utils/src/ehex/bulk-trigger-data-pipeline.ts
 */

dayjs.extend(duration);

const patientIds: string[] = [];
// Alternatively, provide a file with patient IDs, one per line
const fileName = "";

const overrideIsTargetedQueryEnabled = true;
const overrideDemoAugEnabled = true;
const isUseAugmentedDemoOnFirstRun = false;
const isSkipPd = true;
const isScheduledDq = true;
const forceDownload = false;
const countResourcesBeforeAndAfter = true;
const isConsiderConversion = countResourcesBeforeAndAfter;

const cxId = getEnvVarOrFail("CX_ID");
const apiUrlLb = getEnvVarOrFail("API_URL_LB");

// If we're running DQ, keep batch size small to avoid impacting customers.
const PATIENT_BATCH_SIZE = isSkipPd || isScheduledDq ? 5 : 10;
const POLL_INTERVAL_MS = dayjs.duration(10, "seconds").asMilliseconds();
const MAX_WAIT_MS = dayjs.duration(5, "minutes").asMilliseconds();
const SLEEP_AFTER_TRIGGER_MS = dayjs.duration(3, "seconds").asMilliseconds();
const WAIT_JITTER_MIN_MS = 50;
const WAIT_JITTER_MAX_MS = 300;
// When triggering DQ w/o PD, want to make sure count resources has time to complete before DQ resets consolidated
const sleepBeforeTriggerDq = dayjs.duration(3, "seconds");
const maxApiTimeout = dayjs.duration(28, "seconds");

const folderName = buildPathInsideRunsFolder(`ehex-bulk-trigger-data-pipeline`);
const jobId = buildDayjs().toISOString().slice(0, 19).replace(/[:.]/g, "-");
const resourceCountFileName = "resource-count";
const csvFileName = `${folderName}/${cxId}/${jobId}/${resourceCountFileName}.csv`;

const EHEX_NETWORK = "EHEX";

type PdResponse = {
  data: {
    requestId: string;
  };
};
type DqResponse = PdResponse;

type ResourceCount = {
  initial?: number | string;
  final?: number | string;
};

type PatientStateResponse = {
  data: {
    patientState: PatientState & { isCompleted: boolean };
  };
};

async function main() {
  const startedAt = buildDayjs().valueOf();
  const { log } = out("");

  let metriportApi: MetriportMedicalApi | undefined;
  if (countResourcesBeforeAndAfter) {
    const apiUrl = getEnvVarOrFail("API_URL");
    const apiKey = getEnvVarOrFail("API_KEY");
    metriportApi = new MetriportMedicalApi(apiKey, {
      baseAddress: apiUrl,
      timeout: maxApiTimeout.asMilliseconds(),
    });
  }

  try {
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
    if (patientIds.length === 0) {
      log("No patientIds configured. Set patientIds in the script or fileName and re-run.");
      return;
    }
    log(`>>> Starting at ${buildDayjs().toISOString()}...`);
    await displayInitialWarningAndConfirmation(patientIds.length);

    const batches = chunk(patientIds, PATIENT_BATCH_SIZE);

    if (countResourcesBeforeAndAfter) {
      initFile(csvFileName);
      const headers = "patientId,resource-count-before,resource-count-after" + "\n";
      fs.writeFileSync(csvFileName, headers);
    }

    const resourceCountMap = new Map<string, ResourceCount>();
    let processedCount = 0;
    for (const [i, batch] of batches.entries()) {
      await processBatch(batch, i, batches.length, resourceCountMap, metriportApi);
      processedCount += batch.length;
      if (shouldStopScript()) {
        log(`Stopping script after ${processedCount}/${patientIds.length} patients.`);
        break;
      }
    }

    const isAllPatientsProcessed = processedCount === patientIds.length;
    if (!isAllPatientsProcessed) {
      log(`Processed ${processedCount} patients.`);
    } else {
      log(`All ${patientIds.length} patients processed.`);
    }
    if (countResourcesBeforeAndAfter) {
      const fileName = `${folderName}/${cxId}/${jobId}/${resourceCountFileName}.json`;
      initFile(fileName);
      fs.writeFileSync(fileName, JSON.stringify(Object.fromEntries(resourceCountMap), null, 2));
      log("Resource count map saved in", fileName);
    }
    log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
  } catch (err) {
    const msg = "Bulk trigger data pipeline failed.";
    log(`${msg}. Error - ${errorToString(err)}`);
    log(`>>> Elapsed before failure: ${elapsedTimeAsStr(startedAt)}`);
    throw err;
  } finally {
    if (countResourcesBeforeAndAfter) log(`Resource count csv saved in ${csvFileName}`);
  }
  process.exit(0);
}

async function processBatch(
  patients: string[],
  batchIndex: number,
  totalBatches: number,
  resourceCountMap: Map<string, ResourceCount>,
  metriportApi?: MetriportMedicalApi | undefined
): Promise<void> {
  const startedAt = buildDayjs().valueOf();

  const log = out(`Batch ${batchIndex + 1}/${totalBatches}`).log;
  const operationDetails = isScheduledDq ? " with scheduled DQ" : "";
  log(`Triggering ${isSkipPd ? "DQ" : "PD"}${operationDetails} for ${patients.length} patients`);

  const patientToRequestId: Array<{ patientId: string; requestId: string }> = [];
  for (const patientId of patients) {
    const initialResourceCountPromise = getResourceCount(patientId, metriportApi);
    const requestIdPromise = isSkipPd
      ? triggerEhexDq(patientId)
      : triggerEhexPdWithScheduledDq(patientId);
    const [initialResourceCount, requestId] = await Promise.all([
      initialResourceCountPromise,
      requestIdPromise,
    ]);

    if (initialResourceCount || initialResourceCount === 0) {
      resourceCountMap.set(patientId, { initial: initialResourceCount });
    }
    patientToRequestId.push({ patientId, requestId });
    log(`Triggered ${isSkipPd ? "DQ" : "PD"} for patient ${patientId} -> requestId ${requestId}`);
  }

  await sleep(SLEEP_AFTER_TRIGGER_MS); // Needed to allow the API to create patient state
  log(
    `Waiting for all ${patients.length} patients to complete (pd/dq/dr, ${
      isConsiderConversion ? "considering" : "ignoring"
    } conversion)...`
  );
  await executeAsynchronously(
    patientToRequestId,
    ({ patientId, requestId }) => waitUntilCompleted(patientId, requestId, log),
    { minJitterMillis: WAIT_JITTER_MIN_MS, maxJitterMillis: WAIT_JITTER_MAX_MS }
  );

  if (countResourcesBeforeAndAfter) {
    if (!metriportApi) {
      throw new Error("metriportApi is required when countResourcesBeforeAndAfter is true");
    }
    await executeAsynchronously(
      patients,
      async (patientId: string) => {
        const finalResourceCount = await getResourceCount(patientId, metriportApi);
        const initialResourceCount = resourceCountMap.get(patientId)?.initial;
        const initialValue = initialResourceCount ?? "N/A";
        const finalValue = finalResourceCount ?? "N/A";
        resourceCountMap.set(patientId, {
          initial: initialValue,
          final: finalValue,
        });
        const resourceCountAsCsv = `${patientId},${initialValue},${finalValue}` + "\n";
        fs.appendFileSync(csvFileName, resourceCountAsCsv);
      },
      {
        minJitterMillis: WAIT_JITTER_MIN_MS,
        maxJitterMillis: WAIT_JITTER_MAX_MS,
      }
    );
  }

  log(`Batch ${batchIndex + 1} completed in ${elapsedTimeAsStr(startedAt)}`);
}

async function getResourceCount(
  patientId: string,
  metriportApi?: MetriportMedicalApi
): Promise<number | undefined> {
  if (!metriportApi) return undefined;

  try {
    const resp = await executeWithNetworkRetries(async () =>
      metriportApi.countPatientConsolidated(patientId)
    );
    return resp.total;
  } catch (error) {
    console.log(`Error getting resource count for patient ${patientId}: ${errorToString(error)}`);
  }
  return undefined;
}

async function triggerEhexPdWithScheduledDq(patientId: string): Promise<string> {
  const endpointUrl = `${apiUrlLb}/internal/ehex/patient-discovery/${patientId}`;
  const params = new URLSearchParams({
    cxId,
    isScheduledDq: isScheduledDq.toString(),
    forceDownload: forceDownload.toString(),
    overrideIsTargetedQueryEnabled: overrideIsTargetedQueryEnabled.toString(),
    ...(overrideDemoAugEnabled != undefined
      ? { overrideDemoAugEnabled: overrideDemoAugEnabled.toString() }
      : {}),
    isUseAugmentedDemoOnFirstRun: isUseAugmentedDemoOnFirstRun.toString(),
  });
  const resp = (await axios.post(`${endpointUrl}?${params}`)) as PdResponse;
  return resp.data.requestId;
}

async function triggerEhexDq(patientId: string): Promise<string> {
  const endpointUrl = `${apiUrlLb}/internal/ehex/document-query/${patientId}`;
  const params = new URLSearchParams({
    cxId,
    forceDownload: forceDownload.toString(),
  });
  await sleep(sleepBeforeTriggerDq.asMilliseconds());
  const resp = (await axios.post(`${endpointUrl}?${params}`)) as DqResponse;
  return resp.data.requestId;
}

async function waitUntilCompleted(
  patientId: string,
  requestId: string,
  log: (msg: string) => void
): Promise<void> {
  const startedAt = buildDayjs().valueOf();
  while (buildDayjs().valueOf() - startedAt < MAX_WAIT_MS) {
    try {
      const patientState = await getPatientState(patientId, requestId);
      if (patientState.isCompleted === true) {
        log(`Patient ${patientId} processing complete`);
        return;
      }
      log(
        `Patient ${patientId} still processing (after ${elapsedTimeAsStr(
          startedAt
        )}), will poll again...`
      );
      await sleep(POLL_INTERVAL_MS);
    } catch (error) {
      // if the error is 404, log that it doesn't have state and return
      if (error instanceof AxiosError && error.response?.status === 404) {
        log(`Patient ${patientId} does not have state, continuing...`);
        return;
      }
      throw error;
    }
  }
  log(`Timeout waiting for completion for patient ${patientId}, requestId ${requestId}`);
}

async function getPatientState(
  patientId: string,
  requestId: string
): Promise<PatientState & { isCompleted: boolean }> {
  const endpointUrl = `${apiUrlLb}/internal/patient/${patientId}/state`;
  const params = new URLSearchParams({
    cxId,
    network: EHEX_NETWORK,
    requestId,
    isConsiderConversion: isConsiderConversion.toString(),
  });
  const resp = (await axios.get(`${endpointUrl}?${params}`)) as PatientStateResponse;
  return resp.data.patientState;
}

async function displayInitialWarningAndConfirmation(numberPatients: number) {
  const log = console.log;
  log("\n\x1b[31m%s\x1b[0m\n", "---- ATTENTION - THIS IS NOT A SIMULATED RUN ----");
  const operation = isSkipPd ? "DQ" : "PD";
  const operationDetails = ` ${isScheduledDq ? "with" : "without"} scheduled DQ`;
  const completionMsg = isConsiderConversion ? "considering conversion" : "ignoring conversion";
  const message =
    `Triggering Ehex ${operation}${operationDetails} for ${numberPatients} patients in batches of ${PATIENT_BATCH_SIZE}. ` +
    `CX: ${cxId}. Waiting for processing complete (${completionMsg}) before each next batch.`;
  await confirm(message, log);
}

main();
