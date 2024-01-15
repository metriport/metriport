import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { DocumentReference } from "@medplum/fhirtypes";
import * as fs from "fs";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sizeInBytes } from "@metriport/core/util/string";
import axios from "axios";

/**
 * This script creates a document reference for a medical document and uploads the document to s3.
 */

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const patientId = getEnvVarOrFail("PATIENT_ID");

const filePath = "./src/shorter_example.xml";

const metriportApi = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

//eslint-disable-next-line @typescript-eslint/no-explicit-any
async function put(url: string, data: any) {
  const response = await axios.put(url, data, {
    headers: {
      "Content-Length": sizeInBytes(data),
    },
  });

  return response.data;
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
  const fileContent = fs.readFileSync(filePath); // works for pdf and xml
  if (!fileContent) throw new Error("File content is empty");

  const resp = await metriportApi.createDocumentReference(patientId, docRef);
  console.log("getUploadDocumentUrl response:", resp);

  try {
    console.log("Uploading file to S3...");
    await put(resp.uploadUrl, fileContent);
    console.log("Upload successful! :)");
  } catch (err) {
    console.log("ERROR:", err);
  }
}

main();
