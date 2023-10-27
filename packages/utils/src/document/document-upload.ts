import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { DocumentReference } from "@medplum/fhirtypes";
import * as fsPromises from "fs/promises";
// import * as fs from "fs";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sizeInBytes } from "@metriport/core/util/string";
import axios from "axios";

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const patientId = getEnvVarOrFail("PATIENT_ID");

const filePath = "../src/pdf_example.pdf";

const metriportApi = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

async function readFileAsync(filePath: string) {
  try {
    return await fsPromises.readFile(filePath, "utf8");
  } catch (err) {
    console.error(err);
  }
}

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
  const fileContent = await readFileAsync(filePath); // works for xml; doesn't work for pdf
  // const fileContent = fs.readFileSync("./src/pdf_example.pdf"); // works for pdf; hasn't been tested with xml
  if (!fileContent) throw new Error("File content is empty");

  const presignedUrl = await metriportApi.getDocumentUploadUrl(patientId, docRef);
  console.log("presignedUrl", presignedUrl);

  try {
    console.log("Uploading file to S3...");
    await put(presignedUrl, fileContent);
    console.log("Upload successful! :)");
  } catch (err) {
    console.log("ERROR:", err);
  }
}

main();
