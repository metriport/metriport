import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sleep } from "@metriport/shared";
import axios, { CreateAxiosDefaults } from "axios";
import base64url from "base64url";
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

const cxId = "";
const patientIds: string[] = [];

// The date range is inclusive on both ends
const fromDate = undefined;
const toDate = undefined;

const resources: string[] | undefined = undefined;
const conversionType = "pdf";

const timeBetweenPatients = 5_000;

const apiUrl = getEnvVarOrFail("API_URL");

const axiosConfig: CreateAxiosDefaults = {
  timeout: 120_000,
  baseURL: apiUrl,
  headers: {
    "x-api-key": base64url.encode(`metriport:${cxId}`),
  },
};
const api = axios.create(axiosConfig);

async function main() {
  console.log(`########################## Running... - started at ${new Date().toISOString()}`);
  const startedAt = Date.now();

  for (const patientId of patientIds) {
    await api.post(`/medical/v1/patient/${patientId}/consolidated/query`, undefined, {
      params: { resources: resources && resources.join(","), fromDate, toDate, conversionType },
    });
    await sleep(timeBetweenPatients);
  }

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`########################## Total time: ${duration} ms / ${durationMin} min`);
}

main();
