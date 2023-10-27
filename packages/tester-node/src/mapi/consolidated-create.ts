import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

const apiUrl = getEnvVarOrFail("API_URL");
const apiToken = getEnvVarOrFail("API_KEY");
const patientId = getEnvVarOrFail("PATIENT_ID");

async function main() {
  console.log(`Calling createPatientConsolidated...`);

  const metriport = new MetriportMedicalApi(apiToken, {
    baseAddress: apiUrl,
  });

  const createResult = await metriport.createPatientConsolidated(patientId, {
    resourceType: "Bundle",
    type: "collection",
    entry: [
      {
        resource: {
          resourceType: "Appointment",
          status: "booked",
          start: "2021-05-24T13:20:00.000Z",
          end: "2021-05-24T13:55:00.000Z",
          participant: [
            {
              actor: {
                reference: `Patient/${patientId}`,
                display: "John Doe",
              },
              status: "accepted",
              period: {
                start: "2021-05-24T13:21:28.527Z",
                end: "2021-05-24T13:21:28.527Z",
              },
            },
          ],
          meta: {
            versionId: "12345",
            lastUpdated: "2023-05-24T13:21:28.527Z",
          },
        },
      },
    ],
  });
  console.log(`Result: ${JSON.stringify(createResult, null, 2)}`);
}

main();
