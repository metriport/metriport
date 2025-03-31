// import { faker } from "@faker-js/faker";
// import { Bundle, BundleEntry, DiagnosticReport } from "@medplum/fhirtypes";
// import { createUploadFilePath } from "@metriport/core/domain/document/upload";
// import { HapiFhirClient } from "@metriport/core/external/fhir/api/api-hapi";
// import * as s3Upload from "@metriport/core/fhir-to-cda/upload";
// import { v4 as uuidv4 } from "uuid";
// import { Config } from "../../../../shared/config";
// import { diagnosticReport, patient, transactionRespBundle } from "../../__tests__/fhir-payloads";
// import {
//   createOrUpdateConsolidatedPatientData,
//   sentToFhirServerPrefix,
// } from "../consolidated-create";

// let fhir_readResource: jest.SpyInstance;
// let fhir_executeBatch: jest.SpyInstance;
// let uploadFhirBundleToS3_mock: jest.SpyInstance;
// beforeAll(() => {
//   jest.restoreAllMocks();
//   Config.getFHIRServerUrl = jest.fn(() => "http://localhost:8888");
//   fhir_readResource = jest.spyOn(HapiFhirClient.prototype, "readResource");
//   fhir_executeBatch = jest.spyOn(HapiFhirClient.prototype, "executeBatch");
//   uploadFhirBundleToS3_mock = jest.spyOn(s3Upload, "uploadFhirBundleToS3").mockResolvedValue();
// });
// afterAll(() => {
//   jest.restoreAllMocks();
// });

// describe("createConsolidateData", () => {
//   let cxId: string;
//   let patientId: string;
//   let requestId: string;
//   beforeEach(() => {
//     cxId = uuidv4();
//     patientId = uuidv4();
//     requestId = uuidv4();
//   });

//   it("appends PUT transaction and patient when resource does exist and converting fhir bundle", async () => {
//     fhir_readResource.mockReturnValueOnce(patient);
//     fhir_executeBatch.mockReturnValueOnce(transactionRespBundle);
//     const diagnosticId = faker.number.int();
//     const toFhirServerBundleKey = createUploadFilePath(
//       cxId,
//       patientId,
//       `${requestId}_${sentToFhirServerPrefix}.json`
//     );

//     const diagnosticReportWithId: BundleEntry<DiagnosticReport> = {
//       resource: {
//         ...diagnosticReport.resource,
//         resourceType: "DiagnosticReport",
//         id: diagnosticId.toString(),
//       },
//     };

//     const collectionBundle: Bundle = {
//       resourceType: "Bundle",
//       type: "collection",
//       entry: [diagnosticReportWithId],
//     };

//     const resp = await createOrUpdateConsolidatedPatientData({
//       cxId,
//       patientId,
//       bundleDestinationKey: requestId,
//       fhirBundle: collectionBundle,
//     });

//     const putDiagnosticReport: BundleEntry<DiagnosticReport> = {
//       resource: {
//         ...diagnosticReportWithId.resource,
//         resourceType: "DiagnosticReport",
//       },
//       request: {
//         method: "PUT",
//         url: diagnosticReportWithId?.resource?.resourceType + `/${diagnosticId}`,
//       },
//     };
//     const convertedFhirBundle: Bundle = {
//       resourceType: "Bundle",
//       type: "transaction",
//       entry: [putDiagnosticReport],
//     };

//     expect(resp).toBeTruthy();
//     expect(resp).toEqual(transactionRespBundle);
//     expect(fhir_executeBatch).toHaveBeenCalledTimes(1);
//     expect(fhir_executeBatch).toHaveBeenCalledWith(convertedFhirBundle);
//     expect(uploadFhirBundleToS3_mock).toHaveBeenCalledTimes(1);
//     expect(uploadFhirBundleToS3_mock).toHaveBeenCalledWith(
//       expect.objectContaining({
//         fhirBundle: convertedFhirBundle,
//         destinationKey: toFhirServerBundleKey,
//       })
//     );
//   });
// });
