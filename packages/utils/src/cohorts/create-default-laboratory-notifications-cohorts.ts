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
 * This script creates a default Laboratory notifications enabled cohort for a list of given CX ID.
 * Note that this supports multiple CX IDs at a time. Compared to the ADT script which does not.
 *
 * This script will:
 * - For each CX ID:
 * - Get all patients with Laboratory notifications subscriptions
 * - Create a default Laboratory notifications enabled cohort
 * - Add all patients with Laboratory notifications subscriptions to the cohort
 *
 * Steps to run:
 *  1. Set the API_URL in your environment variables.
 *  2. Set the CxIds to the CXs you want to create default cohorts for.
 *  3. Run the script using: ts-node src/cohorts/create-default-laboratory-notifications-cohorts.ts
 *
 */

// SET YOUR VARIABLES V

const apiUrl = getEnvVarOrFail("API_URL");

const cxIds: string[] = ["cxId1", "cxId2"];

// SET YOUR VARIABLES ^

function getDefaultLaboratoryNotificationsCohort(cxId: string) {
  return {
    cxId,
    name: "Laboratory notifications subscribers",
    description: "Auto-created By Metriport",
    settings: {
      monitoring: {
        ...DEFAULT_MONITORING,
        laboratory: {
          notifications: true,
        },
      },
      overrides: {},
    },
  };
}

const NAME_OF_SCRIPT = "createDefaultLaboratoryNotificationsCohorts";
const { log } = out(`${NAME_OF_SCRIPT} `);
async function createDefaultLaboratoryNotificationsCohorts() {
  const startedAt = await startScript({
    nameOfScript: NAME_OF_SCRIPT,
    dryRun: false,
    optionalParams: {
      cxIds: cxIds.join(","),
      apiUrl,
    },
  });
  for (let cxIdIndex = 0; cxIdIndex < cxIds.length; cxIdIndex++) {
    const cxId = cxIds[cxIdIndex];
    log(`Starting for CxId: ${cxId}`);

    const patientIds = await getPatientIdsForPatientsWithLaboratoryNotifications({ cxId });
    log(`Found ${patientIds.length} patients with Laboratory notifications subscriptions`);

    if (patientIds.length < 1) {
      log(`No patients with Laboratory notifications subscriptions found. Skipping ${cxId}`);
      continue;
    }

    const cohortId = await createCohort({
      apiUrl,
      cxId,
      cohortData: getDefaultLaboratoryNotificationsCohort(cxId),
    });

    const message = await addPatientsToCohort({ apiUrl, cxId, cohortId, patientIds });
    log(`Add patients to cohort responded with: ${message}`);
    const delayTime = getDelayTime({ log });
    log(`Sleeping for ${delayTime} ms before the next CxId...`);
    await sleep(delayTime);
  }
  await endScript({
    nameOfScript: NAME_OF_SCRIPT,
    startedAt,
    optionalParams: {
      cxIds: cxIds.join(","),
    },
  });
}

const INTERNAL_PATIENT_IDS_WITH_LABORATORY_NOTIFICATIONS_ENDPOINT =
  "internal/patient/settings/laboratory-notifications";
async function getPatientIdsForPatientsWithLaboratoryNotifications({
  cxId,
}: {
  cxId: string;
}): Promise<string[]> {
  const response = await axios.get(
    `${apiUrl}/${INTERNAL_PATIENT_IDS_WITH_LABORATORY_NOTIFICATIONS_ENDPOINT}`,
    {
      params: { cxId },
    }
  );
  return response.data;
}

createDefaultLaboratoryNotificationsCohorts();
