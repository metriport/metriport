import { Bundle, BundleEntry, DiagnosticReport } from "@medplum/fhirtypes";
import { HapiFhirClient } from "@metriport/core/external/fhir/api/api-hapi";
import { v4 as uuidv4 } from "uuid";
import { diagnosticReport, patient, transactionRespBundle } from "../../__tests__/fhir-payloads";
import { createOrUpdateConsolidatedPatientData } from "../consolidated-create";

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

  it("appends POST transaction and patient when resource does not exist and converting fhir bundle", async () => {
    fhir_readResource.mockReturnValueOnce(patient);

    fhir_executeBatch.mockReturnValueOnce(transactionRespBundle);

    const collectionBundle: Bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [diagnosticReport],
    };

    const resp = await createOrUpdateConsolidatedPatientData({
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

    expect(resp).toBeTruthy();
    expect(resp).toEqual(transactionRespBundle);
    expect(fhir_executeBatch).toHaveBeenCalledTimes(1);
    expect(fhir_executeBatch).toHaveBeenCalledWith(convertedFhirBundle);
  });

  it("appends PUT transaction and patient when resource does exist and converting fhir bundle", async () => {
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

    const resp = await createOrUpdateConsolidatedPatientData({
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

    expect(resp).toBeTruthy();
    expect(resp).toEqual(transactionRespBundle);
    expect(fhir_executeBatch).toHaveBeenCalledTimes(1);
    expect(fhir_executeBatch).toHaveBeenCalledWith(convertedFhirBundle);
  });
});
