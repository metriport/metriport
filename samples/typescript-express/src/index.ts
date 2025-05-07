import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import/setup before the other imports
import { MetriportMedicalApi, USState } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/shared";

const apiKey = getEnvVarOrFail("METRIPORT_API_KEY");
const isProd = getEnvVarOrFail("IS_PROD") === "true";

const metriportClient = new MetriportMedicalApi(apiKey, {
  baseAddress: isProd ? "https://api.metriport.com" : "https://api.sandbox.metriport.com",
});

async function main() {
  const facilityId = getEnvVarOrFail("FACILITY_ID");

  // CREATE A PATIENT
  // Expected response https://docs.metriport.com/medical-api/api-reference/patient/create-patient#response
  const patient = await metriportClient.createPatient(
    {
      firstName: "Jose",
      lastName: "Juarez",
      dob: "1951-05-05",
      genderAtBirth: "M",
      personalIdentifiers: [
        {
          type: "driversLicense",
          state: USState.CA,
          value: "51227265",
        },
      ],
      address: [
        {
          zip: "12345",
          city: "San Diego",
          state: USState.CA,
          country: "USA",
          addressLine1: "Guadalajara Street",
        },
      ],
      contact: [
        {
          phone: "1234567899",
          email: "jose@domain.com",
        },
      ],
      externalId: "123456789",
    },
    facilityId
  );

  let page = 1;
  // const { meta, patients } = await metriportClient.listPatients({ facilityId });
  const { meta, patients } = await metriportClient.listPatients();
  console.log(`Page ${page++} has ${patients.length} patients`);
  // do something with the patients...
  let nextPage = meta.nextPage;
  while (nextPage) {
    const { meta, patients } = await metriportClient.listPatientsPage(nextPage);
    console.log(`Page ${page++} has ${patients.length} patients`);
    // do something with the patients...
    nextPage = meta.nextPage;
  }
  console.log(`Done in ${--page} pages`);

  // START A DOCUMENT QUERY
  // Expected response https://docs.metriport.com/medical-api/api-reference/document/start-document-query#response
  const resp = await metriportClient.startDocumentQuery(patient.id, facilityId);
  console.log(resp);
}

main();
