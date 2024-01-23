import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";

dayjs.extend(duration);
dayjs.extend(isBetween);

/**
 * WIP
 *
 * To run this script, set the env vars, the date range, system/exam code, and the list of patient IDs below.
 */

// Make sure to set the patient IDs below
const patientIds: string[] = [];

// The date range is inclusive on both ends
const fromDate = undefined;
const toDate = undefined;

const resources = undefined;
const conversionType = "pdf";

const timeBetweenPatients = 5_000;

const apiUrl = getEnvVarOrFail("API_URL");
// TODO update these to use `getCxData()` instead
const apiKey = getEnvVarOrFail("API_KEY");

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
  timeout: 120_000,
});

async function main() {
  console.log(`########################## Running... - started at ${new Date().toISOString()}`);
  const startedAt = Date.now();

  for (const patientId of patientIds) {
    await metriportAPI.startConsolidatedQuery(
      patientId,
      resources,
      fromDate,
      toDate,
      conversionType
    );
    await sleep(timeBetweenPatients);
  }

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`########################## Total time: ${duration} ms / ${durationMin} min`);
}

main();
