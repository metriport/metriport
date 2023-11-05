import dotenv from "dotenv";
dotenv.config();

import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const patientId = getEnvVarOrFail("PATIENT_ID");
const facilityId = getEnvVarOrFail("FACILITY_ID");

const metriportApi = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

const metadata = {
  metadata: {
    someKey: "someValue",
    anotherKey: "anotherValue",
  },
};

const metadata2 = {
  metadata: {
    someKey: "someValue2",
    anotherKey: "anotherValue2",
  },
};

async function main() {
  try {
    // console.log("Starting consolidated query...");
    const consolidatedQueryResponse = await metriportApi.startConsolidatedQuery(
      patientId,
      ["AllergyIntolerance"],
      undefined,
      undefined,
      undefined,
      metadata
    );
    console.log("startConsolidatedQuery response:", consolidatedQueryResponse);

    console.log("Starting document query...");
    const documentQueryResponse = await metriportApi.startDocumentQuery(
      patientId,
      facilityId,
      metadata2
    );
    console.log("startDocumentQuery response:", documentQueryResponse);

    console.log("All operations successful! :)");
  } catch (err) {
    console.log("ERROR:", err);
  }
}

main();
