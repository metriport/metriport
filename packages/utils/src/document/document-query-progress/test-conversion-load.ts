import * as dotenv from "dotenv";
dotenv.config();

import { DocumentQuery, MetriportMedicalApi } from "@metriport/api-sdk";
import { MedicalDataSource } from "@metriport/core/external/index";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import duration from "dayjs/plugin/duration";
import dayjs from "dayjs";
import axios from "axios";
import { sleep } from "@metriport/shared";
dayjs.extend(duration);

/**
 * Utility to test the load for the conversion status endpoint.
 *
 * This will:
 *   - we will set the doc query progress for the overall and specified hie
 *   - we will then set the conversion status for given number of requests
 *   - we will then check the doc query progress for the patient is correct
 *
 * Update the respective env variables and run `ts-node handle-conversion-load.ts`
 *
 */

const patientId = "";

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");
const SLEEP_TIME = dayjs.duration({ minutes: 5 });

export const internalApi = axios.create({
  baseURL: apiUrl,
  headers: { "x-api-key": apiKey },
});

const metriportApi = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

const NUM_OF_REQUESTS = 1000;

const docQueryProgress: DocumentQuery = {
  download: {
    status: "completed",
    total: 1,
    successful: 1,
    errors: 0,
  },
  convert: {
    status: "processing",
    total: NUM_OF_REQUESTS,
    successful: 0,
    errors: 0,
  },
};

async function main() {
  try {
    await internalApi.post("/internal/docs/override-progress", docQueryProgress, {
      params: {
        cxId,
        patientId,
        hie: MedicalDataSource.COMMONWELL,
      },
    });

    for (let i = 0; i < NUM_OF_REQUESTS; i++) {
      internalApi.post("/internal/docs/conversion-status", null, {
        params: {
          patientId,
          cxId,
          status: "success",
          source: MedicalDataSource.COMMONWELL,
          jobId: `jobId-${i}`,
        },
      });

      console.log(`Request ${i} sent`);
    }
  } catch (error) {
    console.error("Error", error);
  }

  sleep(SLEEP_TIME.milliseconds());

  const queryStatus = await metriportApi.getDocumentQueryStatus(patientId);

  console.log("queryStatus", JSON.stringify(queryStatus, null, 2));

  const isComplete = queryStatus.convert?.status === "completed";

  console.log(isComplete ? "The load test was successfully completed" : "The load test failed");
}

main();
