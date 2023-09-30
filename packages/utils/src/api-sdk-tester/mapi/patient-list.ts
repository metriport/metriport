import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "../../shared/env";

const apiToken = getEnvVarOrFail("API_KEY");
const facilityId = getEnvVarOrFail("FACILITY_ID");

async function main() {
  const metriport = new MetriportMedicalApi(apiToken, {
    baseAddress: "http://0.0.0.0:8080",
  });

  try {
    console.log(`Calling listPatients...`);
    const deprecated = await metriport.listPatients(facilityId);
    console.log(`Result: ${JSON.stringify(deprecated, null, 2)}`);
  } catch (error) {
    console.log(`error: `, error);
  }
}

main();
