import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { DocumentReference } from "@medplum/fhirtypes";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import FormData from "form-data";
import { createReadStream } from "fs";

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const patientId = getEnvVarOrFail("PATIENT_ID");

const metriportApi = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

async function main() {
  const documentReference: Partial<DocumentReference> = {
    description: "Third degree wrist burn treatment",
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
  const presignedUploadUrl = await metriportApi.getDocumentUploadUrl(patientId, documentReference);

  console.log("Presigned URL:\n", JSON.stringify(presignedUploadUrl, null, 2));
  const form = new FormData();
  Object.entries(presignedUploadUrl.fields).forEach(([field, value]) => {
    form.append(field, value);
  });
  const contentType = "application/xml";
  form.append("Content-Type", contentType);
  form.append("file", createReadStream("./src/shorter_example.xml"));

  console.log("Uploading the file now...");
  form.submit(presignedUploadUrl.url, (err, response) => {
    if (err) {
      console.log(`ERROR: `, err);
      return;
    }
    console.log(`RESPONSE: `, response.statusCode);
  });

  console.log("To post-process the file, use the following script: document-upload-post-process");
}

main();
