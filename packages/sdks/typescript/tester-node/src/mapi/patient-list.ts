import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi, PatientDTO } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

/**
 * Script to make it easy to test the API SDK.
 * TODO: move this to an E2E test on the API SDK itself.
 */
const apiUrl = getEnvVarOrFail("API_URL");
const apiToken = getEnvVarOrFail("API_KEY");
const facilityId = getEnvVarOrFail("FACILITY_ID");
const patientId = getEnvVarOrFail("PATIENT_ID");

async function main() {
  const metriport = new MetriportMedicalApi(apiToken, {
    baseAddress: apiUrl,
  });

  try {
    console.log(`Calling getPatient...`);
    const singlePatient = await metriport.getPatient(patientId);
    console.log(`Single patient: ${JSON.stringify(singlePatient, null, 2)}`);

    let page = 1;
    const allPatients: PatientDTO[] = [];
    const { meta, patients } = await metriport.listPatients({ facilityId });
    console.log(`Page ${page++} has ${patients.length} patients (next page? ${!!meta.nextPage})`);
    allPatients.push(...patients);
    let nextPage = meta.nextPage;
    while (nextPage) {
      const { meta, patients } = await metriport.listPatientsPage(nextPage);
      console.log(`Page ${page++} has ${patients.length} patients (next page? ${!!meta.nextPage})`);
      allPatients.push(...patients);
      nextPage = meta.nextPage;
    }
    console.log(
      `All patients in a given facility: ${JSON.stringify({ patients: allPatients }, null, 2)}`
    );
  } catch (error) {
    console.log(`error: `, error);
  }
}

main();
