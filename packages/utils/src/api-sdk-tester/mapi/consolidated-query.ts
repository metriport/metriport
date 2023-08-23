import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "../../shared/env";

const apiToken = getEnvVarOrFail("API_KEY");
const patientId = getEnvVarOrFail("PATIENT_ID");

const sleep = (timeInMs: number) => new Promise(resolve => setTimeout(resolve, timeInMs));

async function main() {
  console.log(`Calling startConsolidatedQuery...`);

  const metriport = new MetriportMedicalApi(apiToken, {
    baseAddress: "http://0.0.0.0:8080",
  });

  const res = await metriport.startConsolidatedQuery(
    patientId,
    ["DocumentReference", "Appointment"],
    "2021-03-01",
    "2023-04-23"
  );
  console.log(`Result: ${JSON.stringify(res, null, 2)}`);

  console.log(`Now, calling getConsolidatedQueryStatus`);
  let queryStatus = await metriport.getConsolidatedQueryStatus(patientId);
  console.log(`queryStatus: ${JSON.stringify(queryStatus, null, 2)}`);

  console.log(`sleeping...`);
  await sleep(5_000);

  console.log(`Calling getConsolidatedQueryStatus again`);
  queryStatus = await metriport.getConsolidatedQueryStatus(patientId);
  console.log(`queryStatus: ${JSON.stringify(queryStatus, null, 2)}`);
}

main();
