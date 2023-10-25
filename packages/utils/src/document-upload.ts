import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { DocumentReference } from "@medplum/fhirtypes";
import fs from "fs/promises";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const patientId = getEnvVarOrFail("PATIENT_ID");

const metriportApi = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

async function readFileAsync(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    console.error(err);
  }
}

async function main() {
  const docRef: Partial<DocumentReference> = {
    description: "Second degree ankle burn treatment",
    type: {
      text: "Burn management Hospital Progress note",
      coding: [
        {
          code: "100556-0",
          system: "http://loinc.org",
        },
      ],
    },
    context: {
      period: {
        start: "2023-10-10T14:14:17Z",
      },
      facilityType: {
        text: "My Clinic Name - Acute Care",
      },
    },
  };
  const fileContent = await readFileAsync("./src/shorter_example.xml");
  if (!fileContent) throw new Error("File content is empty");

  await metriportApi.uploadDocument(patientId, docRef, fileContent);
}

main();
