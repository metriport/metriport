import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on topimport { createReadStream } from "fs";
import FormData from "form-data";
import { DocumentReference } from "@medplum/fhirtypes";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { createReadStream } from "fs";

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const patientId = getEnvVarOrFail("PATIENT_ID");

const metriportApi = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

async function main() {
  const documentReference: DocumentReference = {
    resourceType: "DocumentReference",
    status: "superseded",
    description: "This is a test file for document upload",
  };
  const presignedUploadUrl = await metriportApi.getDocumentUploadUrl(patientId, documentReference);
  console.log("Result", JSON.stringify(presignedUploadUrl, null, 2));
  console.log("Signed Url is", presignedUploadUrl);

  const form = new FormData();
  Object.entries(presignedUploadUrl.fields).forEach(([field, value]) => {
    form.append(field, value);
  });
  const contentType = "application/xml";
  form.append("Content-Type", contentType);
  form.append("file", createReadStream("./src/shorter_example.xml"));

  form.submit(presignedUploadUrl.url, (err, response) => {
    if (err) {
      console.log(`ERROR: `, err);
      return;
    }
    console.log(`RESPONSE: `, response.statusCode);
  });
}

main();

// import { createReadStream } from "fs";
// import FormData from "form-data";
// import { MetriportMedicalApi } from "@metriport/api-sdk";
// import { uuidv7 } from "./shared/uuid-v7";

// const apiKey = getEnvVarOrFail("API_KEY");
// const apiUrl = getEnvVarOrFail("API_URL");
// const patientId = getEnvVarOrFail("PATIENT_ID");
// const metriportApi = new MetriportMedicalApi(apiKey, {
//   baseAddress: apiUrl,
// });

// async function main() {
// const presignedUploadUrl = await metriportApi.getDocumentUploadUrl(
//   patientId,
//   "Hosp123",
//   "John Snow",
//   "This is a test file for document upload"
// );
// console.log("Signed Url is", presignedUploadUrl);
// const form = new FormData();
// Object.entries(presignedUploadUrl.fields).forEach(([field, value]) => {
//   form.append(field, value);
// });
// const contentType = "application/xml";
// form.append("Content-Type", contentType);
// form.append("file", createReadStream("./src/shorter_example.xml"));
// form.submit(presignedUploadUrl.url, (err, response) => {
//   if (err) {
//     console.log(`ERROR: `, err);
//     return;
//   }
//   console.log(`RESPONSE: `, response.statusCode);
// });
// }
