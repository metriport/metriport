import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sleep } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { elapsedTimeAsStr } from "./shared/duration";
import { initFile } from "./shared/file";
import { buildGetDirPathInside, initRunsFolder } from "./shared/folder";
import { getCxData } from "./shared/get-cx-data";
import { logErrorToFile } from "./shared/log";

dayjs.extend(duration);

/**
 * This script deletes the specified patients from both Metriport and HIEs.
 *
 * To use it:
 * - Set the env vars in the .env file.
 * - Update the `patientIds` array with the list of Patient IDs you want to delete.
 * - Run the script from the utils folder:
 *   - `cd packages/utils`
 *   - `ts-node src/bulk-delete-patients`
 */

// add patient IDs here to kick off queries for specific patient IDs
const patientIds: string[] = [];

const numberOfParallelExecutions = 5;
const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const confirmationTime = dayjs.duration(10, "seconds");

const getOutputFileName = buildGetDirPathInside(`bulk-delete-patients`);

async function main() {
  initRunsFolder();
  const startedAt = Date.now();

  const { orgName, facilityId } = await getCxData(cxId);
  const errorFileName = getOutputFileName(orgName) + ".error";
  initFile(errorFileName);
  const patientsWithErrors: string[] = [];

  if (!patientIds || patientIds.length < 1) {
    console.log(`>>> No patient IDs provided, exiting...`);
    process.exit(0);
  }

  await displayWarningAndConfirmation(patientIds.length, orgName);

  console.log(`>>> Starting to delete ${patientIds.length} patients...`);

  let ptIndex = 0;
  await executeAsynchronously(
    patientIds,
    async patientId => {
      console.log(`>>> Progress: ${++ptIndex}/${patientIds.length} patients complete`);
      try {
        console.log(`>>> Deleting patient ${patientId} from Metriport and HIEs...`);
        await axios.delete(apiUrl + `/internal/patient/${patientId}`, {
          params: { cxId, facilityId },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        const msg = `ERROR processing patient ${patientId}: `;
        console.log(msg, error.message);
        patientsWithErrors.push(patientId);
        logErrorToFile(errorFileName, msg, error);
        fs.appendFileSync(errorFileName + ".patientIds.txt", `${patientId}\n`);
      }
    },
    { numberOfParallelExecutions }
  );
  if (patientsWithErrors.length > 0) {
    console.log(
      `>>> Patients with errors (${patientsWithErrors.length}): ${patientsWithErrors.join(", ")}`
    );
    console.log(`>>> See file ${errorFileName} for more details.`);
  } else {
    console.log(`>>> Yay! All patients were deleted successfully!`);
  }
  console.log(`>>> Done deleting ${patientIds.length} patients in ${elapsedTimeAsStr(startedAt)}`);
  process.exit(0);
}

async function displayWarningAndConfirmation(patientCount: number, orgName: string) {
  console.log(``);
  console.log(
    `THIS IS SUPER DESTRUCTIVE!! IT WILL DELETE PATIENTS FROM METRIPORT AND HIEs! ONLY CONTINUE IF YOU KNOW WHAT YOU ARE DOING!`
  );
  console.log(``);
  console.log(
    `Deleting ${patientCount} patients from org/cx ${orgName} in ${confirmationTime.asSeconds()} seconds...`
  );
  await sleep(confirmationTime.asMilliseconds());
  console.log(`ok, continuing...`);
  await sleep(dayjs.duration(1, "seconds").asMilliseconds());
}

main();
