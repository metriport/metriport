import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { MetriportMedicalApi } from "@metriport/api";

async function main() {
  const apiKey = getEnvVarOrFail("API_KEY");
  const apiAddress = getEnvVarOrFail("API_ADRESS");
  const patientId = getEnvVarOrFail("PATIENT_ID");

  const api = new MetriportMedicalApi(apiKey, { baseAddress: apiAddress });

  console.log(`Getting doc query status...`);
  const res = await api.getDocumentQuery(patientId);
  console.log(`Doc query status: ${JSON.stringify(res, null, 2)}`);

  console.log(`Done`);
}

function getEnvVar(varName: string): string | undefined {
  return process.env[varName];
}
function getEnvVarOrFail(varName: string): string {
  const value = getEnvVar(varName);
  if (!value || value.trim().length < 1) {
    throw new Error(`Missing ${varName} env var`);
  }
  return value;
}

main();
