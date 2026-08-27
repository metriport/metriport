import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else

import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { DEFAULT_MONITORING } from "@metriport/shared/domain/cohort";
import axios from "axios";
import { endScript, startScript } from "../utils";
import { addPatientsToCohort, createCohort } from "./shared";
import { getDelayTime } from "../shared/duration";
import { sleep } from "@metriport/shared/common/sleep";
/**
 *
 * This script creates a default ADT enabled cohort for a given CX ID.
 * Note that it only supports one CX ID at a time. This is on purpose.
 * Sometimes for a single CX we will be loading into memory over 80k patients.
 *
 * This script will:
 * - Get all patients with ADT subscriptions
 * - Create a default ADT enabled cohort
 * - Add all patients with ADT subscriptions to the cohort
 *
 * Steps to run:
 *  1. Set the API_URL in your environment variables.
 *  2. Set the CX_ID in your environment variables.
 *  3. Set the BATCH_SIZE to the size you wish. I recommend 500-1000 (1000 is the max page size).
 *  4. (Optional) Create a file named "delay-time-in-millis.txt" with the delay time in milliseconds.
 *     The script will read this file on each iteration, allowing you to adjust the delay while running.
 *     Default is 5000ms (5 seconds) if the file doesn't exist.
 *  5. Run the script using: ts-node src/cohorts/create-default-adt-cohorts.ts
 *
 */

// SET YOUR VARIABLES V

const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");
const BATCH_SIZE = 100;

// SET YOUR VARIABLES ^

const DEFAULT_ADT_ENABLED_COHORT = {
  cxId,
  name: "ADT subscribers",
  description: "Auto-created By Metriport",
  settings: {
    monitoring: {
      ...DEFAULT_MONITORING,
      adt: {
        enabled: true,
      },
    },
    overrides: {},
  },
};

const NAME_OF_SCRIPT = "createDefaultAdtCohorts";
const { log } = out(`${NAME_OF_SCRIPT}, cxId: ${cxId}`);
async function createDefaultAdtCohorts() {
  const startedAt = await startScript({
    nameOfScript: NAME_OF_SCRIPT,
    dryRun: false,
    optionalParams: {
      cxId,
      apiUrl,
    },
  });

  const cohortId = await createCohort({
    apiUrl,
    cxId,
    cohortData: DEFAULT_ADT_ENABLED_COHORT,
  });

  const totalAmountOfPatients = await addAdtPatientsToCohort({ apiUrl, cxId, cohortId });

  await endScript({
    nameOfScript: NAME_OF_SCRIPT,
    startedAt,
    optionalParams: {
      cxId,
      amountOfPatients: totalAmountOfPatients,
      ...(cohortId ? { cohortId } : {}),
    },
  });
}

type ProcessBatchResult = {
  patientsAdded: number;
  nextPageUrl: string | undefined;
};

const INTERNAL_PATIENT_IDS_WITH_ADTS_ENDPOINT = "internal/patient/settings/adt";
async function addAdtPatientsToCohort({
  apiUrl,
  cxId,
  cohortId,
}: {
  apiUrl: string;
  cxId: string;
  cohortId: string;
}): Promise<number> {
  let totalPatientsAdded = 0;
  let nextPageUrl:
    | string
    | undefined = `${apiUrl}/${INTERNAL_PATIENT_IDS_WITH_ADTS_ENDPOINT}?cxId=${cxId}&count=${BATCH_SIZE}`;

  while (nextPageUrl) {
    const result: ProcessBatchResult = await processBatch({
      nextPageUrl,
      apiUrl,
      cxId,
      cohortId,
    });
    totalPatientsAdded += result.patientsAdded;
    nextPageUrl = result.nextPageUrl;
    if (nextPageUrl) {
      const delayTime = getDelayTime({ log });
      log(`Sleeping for ${delayTime} ms before the next batch...`);
      await sleep(delayTime);
    }
  }

  if (totalPatientsAdded === 0) {
    log("No patients with ADT subscriptions found");
  } else {
    log(`Total patients added: ${totalPatientsAdded}`);
  }

  return totalPatientsAdded;
}

type PaginatedResponse = {
  meta: {
    itemsOnPage: number;
    itemsInTotal?: number;
    nextPage?: string;
  };
  patientIds: string[];
};

async function processBatch({
  nextPageUrl,
  apiUrl,
  cxId,
  cohortId,
}: {
  nextPageUrl: string;
  apiUrl: string;
  cxId: string;
  cohortId: string;
}): Promise<ProcessBatchResult> {
  const response = await axios.get<PaginatedResponse>(nextPageUrl);
  const data: PaginatedResponse = response.data;

  if (!data.patientIds || !Array.isArray(data.patientIds)) {
    throw new Error(
      `Unexpected response format: expected patientIds array, got ${JSON.stringify(data)}`
    );
  }

  if (data.patientIds.length === 0) {
    return { patientsAdded: 0, nextPageUrl: undefined };
  }

  if (!cohortId) {
    throw new Error("Cohort ID is required to add patients");
  }

  const message = await addPatientsToCohort({
    apiUrl,
    cxId,
    cohortId,
    patientIds: data.patientIds,
  });
  log(`Added batch of ${data.patientIds.length} patients to cohort: ${message}`);

  let nextPage: string | undefined = undefined;
  if (data.meta.nextPage) {
    const nextPageUrlObj = new URL(data.meta.nextPage);
    nextPageUrlObj.searchParams.set("cxId", cxId);
    nextPage = nextPageUrlObj.toString();
  }

  return { patientsAdded: data.patientIds.length, nextPageUrl: nextPage };
}

createDefaultAdtCohorts();
