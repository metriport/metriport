import { createReadStream } from "fs";
import FormData from "form-data";
// import { MetriportMedicalApi } from "@metriport/api-sdk";
// import { getEnvVarOrFail } from "./shared/env";

// const apiKey = getEnvVarOrFail("API_KEY");
// const apiUrl = getEnvVarOrFail("API_URL");
// const patientId = getEnvVarOrFail("PATIENT_ID");

// const metriportApi = new MetriportMedicalApi(apiKey, {
//   baseAddress: apiUrl,
// });

async function main() {
  const signedUrl = {}; // paste this from the response of the API call

  const form = new FormData();
  Object.entries(signedUrl.fields).forEach(([field, value]) => {
    form.append(field, value);
  });
  const contentType = "application/xml";
  form.append("Content-Type", contentType);
  form.append("file", createReadStream("./src/shorter_example.xml"));

  form.submit(signedUrl.url, (err, response) => {
    if (err) {
      console.log(`ERROR: `, err);
      return;
    }
    console.log(`RESPONSE: `, response.statusCode);
  });
}

main();
