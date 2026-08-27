import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else

import { endScript, startScript } from "../utils";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import {
  getExcludeHieNameString,
  getHieNames,
} from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import { MetriportError, NUMBER_OF_HIEs } from "@metriport/shared";
import { getCohortByNameOrFail, updateCohort } from "./shared";
import {
  CohortWithSize,
  Overrides,
  STATE_VALIDATION_OVERRIDE_KEY,
} from "@metriport/shared/domain/cohort";
import { out } from "@metriport/core/util";

/**
 *
 * This script adds missing excludes to a cohort.
 *
 * This script will:
 * - Get a cohort by name
 * - Add missing excludes to the cohort
 * - Turn on state validation if requested
 * - Update the cohort with the new overrides
 * - Return the cohort with size
 *
 * Steps to run:
 *  1. Set the API_URL in your environment variables.
 *  2. Set the cxId to the CX ID you want to add missing excludes to.
 *  3. Set the cohortName to the name of the cohort you want to add missing excludes to.
 *  4. Set the includeHieNames to the HIE names you want to include in the cohort. These HIEs will NOT be excluded.
 *  5. Set the shouldTurnOnStateValidation if you want to turn on state validation.
 *  6. Set the dryRun to false if you want to update the cohort.
 *  7. Run the script using: ts-node src/cohorts/add-missing-excludes-to-cohorts.ts
 *
 */

// SET YOUR VARIABLES V

const apiUrl = getEnvVarOrFail("API_URL");
const cxId = "";
const cohortName = "ADT subscribers";
const includeHieNames: string[] = ["hieName1", "hieName2"];
const shouldTurnOnStateValidation = false;
const dryRun = true;

// SET YOUR VARIABLES ^

const NAME_OF_SCRIPT = "addMissingExcludesToCohorts";
const { log } = out(`${NAME_OF_SCRIPT}, dryRun: ${dryRun}`);
async function addMissingExcludesToCohorts() {
  const startTime = await startScript({
    nameOfScript: NAME_OF_SCRIPT,
    dryRun,
    optionalParams: {
      cxId,
      includeHieNames: includeHieNames.join(","),
      shouldTurnOnStateValidation,
    },
  });
  validateHieNamesOrFail(includeHieNames);

  const cohortId = await getCohortByNameOrFail({ apiUrl, cxId, cohortName });
  log(`Got cohort ID: ${cohortId}`);

  const cohortWithSize = await addExcludesToCohort({
    apiUrl,
    cxId,
    cohortId,
    includeHieNames,
    shouldTurnOnStateValidation,
  });

  const message = dryRun
    ? "Cohort was not updated because of Dry Run"
    : `Cohort after update: \n${JSON.stringify(cohortWithSize, null, 2)}\n`;
  log(`${message}`);
  await endScript({
    nameOfScript: NAME_OF_SCRIPT,
    startedAt: startTime,
  });
}

addMissingExcludesToCohorts();

function validateHieNamesOrFail(hieNames: string[]): void {
  const validHieNames = getHieNames();
  if (validHieNames.length !== NUMBER_OF_HIEs) {
    throw new MetriportError(
      `Expected ${NUMBER_OF_HIEs} HIE names in your config dictionary. Please check the config dictionary and try again.`,
      undefined,
      {
        validHieNames: validHieNames.join(","),
        numberOfHieNames: NUMBER_OF_HIEs,
        actualNumberOfHieNames: validHieNames.length,
      }
    );
  }

  if (hieNames.length < 1) {
    throw new MetriportError(
      `No HIE names provided. Please provide at least one HIE name.`,
      undefined,
      {
        hieNames: hieNames.join(","),
        validHieNames: validHieNames.join(","),
      }
    );
  }

  const invalidHieNames = hieNames.filter(hieName => !validHieNames.includes(hieName));
  if (invalidHieNames.length > 0) {
    throw new MetriportError(
      `Invalid HIE names. Please check the HIE names and try again.`,
      undefined,
      {
        hieNames: invalidHieNames.join(","),
        validHieNames: validHieNames.join(","),
      }
    );
  }
}

async function addExcludesToCohort({
  apiUrl,
  cxId,
  cohortId,
  includeHieNames,
  shouldTurnOnStateValidation,
}: {
  apiUrl: string;
  cxId: string;
  cohortId: string;
  includeHieNames: string[];
  shouldTurnOnStateValidation: boolean;
}): Promise<CohortWithSize | undefined> {
  const overrides = createOverridesSettings({ includeHieNames, shouldTurnOnStateValidation });
  const settings = {
    settings: {
      overrides,
    },
  };
  const message = dryRun
    ? `Would have updated cohort with data: \n${JSON.stringify(settings, null, 2)}\n`
    : `Updating cohort with data: \n${JSON.stringify(settings, null, 2)}\n`;
  log(message);
  if (!dryRun) {
    return await updateCohort({ apiUrl, cxId, cohortId, cohortData: settings });
  }
  return undefined;
}

function createOverridesSettings({
  includeHieNames,
  shouldTurnOnStateValidation,
}: {
  includeHieNames: string[];
  shouldTurnOnStateValidation: boolean;
}): Overrides {
  const hieNames = getHieNames();
  const includeHieNamesSet = new Set(includeHieNames);

  const excludeHieNames = hieNames.filter(hieName => !includeHieNamesSet.has(hieName));

  const overrides: Overrides = {};

  for (const hieName of excludeHieNames) {
    overrides[getExcludeHieNameString(hieName)] = true;
  }
  for (const hieName of includeHieNamesSet) {
    overrides[getExcludeHieNameString(hieName)] = false;
  }

  if (shouldTurnOnStateValidation) {
    overrides[STATE_VALIDATION_OVERRIDE_KEY] = true;
  } else {
    overrides[STATE_VALIDATION_OVERRIDE_KEY] = false;
  }

  return overrides;
}
