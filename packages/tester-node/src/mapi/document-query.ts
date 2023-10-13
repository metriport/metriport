import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

async function main() {
  const apiKey = getEnvVarOrFail("API_KEY");
  const apiAddress = getEnvVarOrFail("API_ADRESS");
  const patientId = getEnvVarOrFail("PATIENT_ID");

  const api = new MetriportMedicalApi(apiKey, { baseAddress: apiAddress });

  console.log(`Getting doc query status...`);
  const res = await api.getDocumentQueryStatus(patientId);
  console.log(`Doc query status: ${JSON.stringify(res, null, 2)}`);

  console.log(`Done`);
}

main();
