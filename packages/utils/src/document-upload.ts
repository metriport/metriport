// import { createReadStream } from "fs";
// import FormData from "form-data";
// import { MetriportMedicalApi } from "@metriport/api-sdk";
// import { uuidv7 } from "./shared/uuid-v7";
// import { DocumentReference } from "@medplum/fhirtypes";

// // const apiKey = getEnvVarOrFail("API_KEY");
// // const apiUrl = getEnvVarOrFail("API_URL");
// // const patientId = getEnvVarOrFail("PATIENT_ID");

// const metriportApi = new MetriportMedicalApi(apiKey, {
//   baseAddress: apiUrl,
// });

// async function main() {
//     const documentReference: DocumentReference = {
//         resourceType: "DocumentReference",
//         status: "current",
//         description: "This is a test file for document upload",
//     }
//     const documentReferenceResponse = await metriportApi.getDocumentUploadUrl(patientId, documentReference);
//     console.log("Result", documentReferenceResponse);
// // const presignedUploadUrl = await metriportApi.getDocumentUploadUrl(
// //   patientId,
// //   "Hosp123",
// //   "John Snow",
// //   "This is a test file for document upload"
// // );
// // console.log("Signed Url is", presignedUploadUrl);
// // const form = new FormData();
// // Object.entries(presignedUploadUrl.fields).forEach(([field, value]) => {
// //   form.append(field, value);
// // });
// // const contentType = "application/xml";
// // form.append("Content-Type", contentType);
// // form.append("file", createReadStream("./src/shorter_example.xml"));
// // form.submit(presignedUploadUrl.url, (err, response) => {
// //   if (err) {
// //     console.log(`ERROR: `, err);
// //     return;
// //   }
// //   console.log(`RESPONSE: `, response.statusCode);
// // });
// }

// main();
