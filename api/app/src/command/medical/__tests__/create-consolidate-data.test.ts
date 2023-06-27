import { Bundle, BundleEntry, DiagnosticReport } from "@medplum/fhirtypes";
import { v4 as uuidv4 } from "uuid";
import { HapiFhirClient } from "../../../external/fhir/api/api-hapi";
import { createConsolidatedPatientData } from "../patient/create-consolidate-data";
import { patient, diagnosticReport, transactionRespBundle } from "./fhir-payloads";

let fhir_readResource: jest.SpyInstance;
let fhir_executeBatch: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  fhir_readResource = jest.spyOn(HapiFhirClient.prototype, "readResource");
  fhir_executeBatch = jest.spyOn(HapiFhirClient.prototype, "executeBatch");
});

describe("createConsolidateData", () => {
  const cxId = uuidv4();
  const patientId = uuidv4();

  it("appends POST transaction and patient when converting fhir bundle", async () => {
    fhir_readResource.mockReturnValueOnce(patient);

    fhir_executeBatch.mockReturnValueOnce(transactionRespBundle);

    const collectionBundle: Bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [diagnosticReport],
    };

    const resp = await createConsolidatedPatientData({
      cxId,
      patientId,
      fhirBundle: collectionBundle,
    });

    const postDiagnosticReport: BundleEntry<DiagnosticReport> = {
      resource: {
        ...diagnosticReport.resource,
        resourceType: "DiagnosticReport",
        contained: [patient],
      },
      request: {
        method: "POST",
        url: diagnosticReport?.resource?.resourceType,
      },
    };

    const convertedFhirBundle: Bundle = {
      resourceType: "Bundle",
      type: "transaction",
      entry: [postDiagnosticReport],
    };

    const validResp = {
      resourceType: "Bundle",
      id: "b2c28be3-8aae-4b3c-b0ff-ca5d0f0b0d1e",
      type: "transaction-response",
      link: [
        {
          relation: "self",
          url: "https://localhost:8888/oauth/fhir/21fa432e-723b-4a1d-a3b2-bd9cd75a0717/21fa432e-723b-4a1d-a3b2-bd9cd75a0717",
        },
      ],
      entry: [
        {
          response: {
            status: "200 OK",
            location: "DiagnosticReport/3f697895-18c2-4da5-b0fe-899bb455f0f0/_history/2",
            etag: "2",
            lastModified: "2023-05-25T00:28:06.321+00:00",
            outcome: {
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "information",
                  code: "informational",
                  details: {
                    coding: [
                      {
                        system:
                          "https://hapifhir.io/fhir/CodeSystem/hapi-fhir-storage-response-code",
                        code: "SUCCESSFUL_UPDATE",
                        display: "Update succeeded.",
                      },
                    ],
                  },
                  diagnostics:
                    'Successfully updated resource "DiagnosticReport/3f697895-18c2-4da5-b0fe-899bb455f0f0/_history/2".',
                },
              ],
            },
          },
        },
      ],
    };

    expect(resp).toBeTruthy();
    expect(resp).toEqual(validResp);
    expect(fhir_executeBatch).toHaveBeenCalledTimes(1);
    expect(fhir_executeBatch).toHaveBeenCalledWith(convertedFhirBundle);
  });

  it("appends PUT transaction and patient when converting fhir bundle", async () => {
    fhir_readResource.mockReturnValueOnce(patient);

    fhir_executeBatch.mockReturnValueOnce(transactionRespBundle);
    const DIAGNOSTIC_ID = "1234";

    const diagnosticReportWithId: BundleEntry<DiagnosticReport> = {
      resource: {
        ...diagnosticReport.resource,
        resourceType: "DiagnosticReport",
        id: DIAGNOSTIC_ID,
      },
    };

    const collectionBundle: Bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [diagnosticReportWithId],
    };

    const resp = await createConsolidatedPatientData({
      cxId,
      patientId,
      fhirBundle: collectionBundle,
    });

    const putDiagnosticReport: BundleEntry<DiagnosticReport> = {
      resource: {
        ...diagnosticReportWithId.resource,
        resourceType: "DiagnosticReport",
        contained: [patient],
      },
      request: {
        method: "PUT",
        url: diagnosticReportWithId?.resource?.resourceType + `/${DIAGNOSTIC_ID}`,
      },
    };

    const convertedFhirBundle: Bundle = {
      resourceType: "Bundle",
      type: "transaction",
      entry: [putDiagnosticReport],
    };

    const validResp = {
      resourceType: "Bundle",
      id: "b2c28be3-8aae-4b3c-b0ff-ca5d0f0b0d1e",
      type: "transaction-response",
      link: [
        {
          relation: "self",
          url: "https://localhost:8888/oauth/fhir/21fa432e-723b-4a1d-a3b2-bd9cd75a0717/21fa432e-723b-4a1d-a3b2-bd9cd75a0717",
        },
      ],
      entry: [
        {
          response: {
            status: "200 OK",
            location: "DiagnosticReport/3f697895-18c2-4da5-b0fe-899bb455f0f0/_history/2",
            etag: "2",
            lastModified: "2023-05-25T00:28:06.321+00:00",
            outcome: {
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "information",
                  code: "informational",
                  details: {
                    coding: [
                      {
                        system:
                          "https://hapifhir.io/fhir/CodeSystem/hapi-fhir-storage-response-code",
                        code: "SUCCESSFUL_UPDATE",
                        display: "Update succeeded.",
                      },
                    ],
                  },
                  diagnostics:
                    'Successfully updated resource "DiagnosticReport/3f697895-18c2-4da5-b0fe-899bb455f0f0/_history/2".',
                },
              ],
            },
          },
        },
      ],
    };

    expect(resp).toBeTruthy();
    expect(resp).toEqual(validResp);
    expect(fhir_executeBatch).toHaveBeenCalledTimes(1);
    expect(fhir_executeBatch).toHaveBeenCalledWith(convertedFhirBundle);
  });
});
