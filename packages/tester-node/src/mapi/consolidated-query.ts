import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

const apiUrl = getEnvVarOrFail("API_URL");
const apiToken = getEnvVarOrFail("API_KEY");
const patientId = getEnvVarOrFail("PATIENT_ID");

const sleep = (timeInMs: number) => new Promise(resolve => setTimeout(resolve, timeInMs));

async function main() {
  const metriport = new MetriportMedicalApi(apiToken, {
    baseAddress: apiUrl,
    timeout: 60_000,
  });

  // console.log(`Calling getPatientConsolidated...`);
  // const deprecated = await metriport.getPatientConsolidated(
  //   patientId,
  //   ["DocumentReference", "Appointment"],
  //   "2021-03-01",
  //   "2023-04-23"
  // );
  // console.log(`Result: ${JSON.stringify(deprecated, null, 2)}`);

  console.log(`Calling getConsolidatedQueryStatus`);
  let queryStatus = await metriport.getConsolidatedQueryStatus(patientId);
  console.log(`queryStatus: ${JSON.stringify(queryStatus, null, 2)}`);

  console.log(`Calling startConsolidatedQuery...`);
  const res = await metriport.startConsolidatedQuery(
    patientId,
    ["DocumentReference", "Appointment"],
    "2021-03-01",
    "2023-04-23"
  );
  console.log(`Result: ${JSON.stringify(res, null, 2)}`);

  console.log(`Now, calling getConsolidatedQueryStatus`);
  queryStatus = await metriport.getConsolidatedQueryStatus(patientId);
  console.log(`queryStatus: ${JSON.stringify(queryStatus, null, 2)}`);

  console.log(`sleeping...`);
  await sleep(5_000);

  console.log(`Calling getConsolidatedQueryStatus again`);
  queryStatus = await metriport.getConsolidatedQueryStatus(patientId);
  console.log(`queryStatus: ${JSON.stringify(queryStatus, null, 2)}`);

  console.log(`Calling getConsolidatedQueryStatus again`);
  const resources = ["Appointment", "Encounter"] as const;
  const dateFrom = "2023-01-01";
  const dateTo = "2023-01-31";
  const count = await metriport.countPatientConsolidated(patientId, resources, dateFrom, dateTo);
  console.log(`count: ${JSON.stringify(count, null, 2)}`);
}

main();
