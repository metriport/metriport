import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk } from "lodash";

/**
 * This script kicks off the patient discovery for the indicated patients.
 *
 * To run:
 * 1. Set the env vars:
 *  - CX_ID
 *  - API_URL
 * 2. Set the patientIds and rerunPdOnNewDemographics
 * 3. Run the script with `ts-node src/bulk-trigger-patient-discovery.ts`
 */

dayjs.extend(duration);

const patientIds: string[] = [];
const rerunPdOnNewDemographics = true;

const confirmationTime = dayjs.duration(10, "seconds");
const delayTime = dayjs.duration(10, "seconds");
const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const PATIENT_CHUNK_SIZE = 2;

type PdResponse = {
  data: {
    requestId: string;
  };
};

async function main() {
  try {
    await displayInitialWarningAndConfirmation(patientIds.length);

    const patientChunks = chunk(patientIds, PATIENT_CHUNK_SIZE);

    for (const [i, patients] of patientChunks.entries()) {
      console.log(`Chunk ${i + 1} of ${patientChunks.length}`);
      console.log(`# of patients ${patients.length}`);

      for (const patientId of patients) {
        const log = out(`PD kick off: cxId - ${cxId}, patientId - ${patientId}`).log;
        const endpointUrl = `${apiUrl}/internal/patient/${patientId}/patient-discovery`;
        const params = new URLSearchParams({
          cxId,
          rerunPdOnNewDemographics: rerunPdOnNewDemographics.toString(),
        });
        const resp = (await axios.post(`${endpointUrl}?${params}`)) as PdResponse;
        log(`Request ID - ${JSON.stringify(resp.data.requestId)}`);
      }
      if (i < patientChunks.length - 1) {
        const sleepTime = delayTime.asMilliseconds();
        console.log(`Chunk ${i + 1} finished. Sleeping for ${sleepTime} ms...`);
        await sleep(sleepTime);
      }
    }
  } catch (err) {
    const msg = "PD kick off failed.";
    console.log(`${msg}. Error - ${err}`);
  }
}

async function displayInitialWarningAndConfirmation(numberPatients: number) {
  console.log("\n\x1b[31m%s\x1b[0m\n", "---- ATTENTION - THIS IS NOT A SIMULATED RUN ----"); // https://stackoverflow.com/a/41407246/2099911
  console.log(
    `Triggering patient discovery for ${numberPatients} patients. CX: ${cxId}. Sleeping ${confirmationTime.asMilliseconds()} ms before starting.`
  );
  await sleep(confirmationTime.asMilliseconds());
}

main();
