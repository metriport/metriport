import * as dotenv from "dotenv";
dotenv.config();
import { MetriportMedicalApi, USState } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

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

  // START A DOCUMENT QUERY
  // Expected response https://docs.metriport.com/medical-api/api-reference/document/start-document-query#response
  const resp = await metriportClient.startDocumentQuery(patient.id, facilityId);

  console.log(resp);
}

main();
