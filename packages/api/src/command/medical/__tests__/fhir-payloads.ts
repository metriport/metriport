import { Patient, Bundle, BundleEntry, DiagnosticReport } from "@medplum/fhirtypes";

export const patient: Patient = {
  resourceType: "Patient",
  id: "1",
  name: [
    {
      family: "John",
      given: ["Doe"],
    },
  ],
};

export const diagnosticReport: BundleEntry<DiagnosticReport> = {
  resource: {
    resourceType: "DiagnosticReport",
    status: "amended",
    code: {
      coding: [
        {
          code: "5678",
          display: "5678",
        },
      ],
    },
  },
};

export const transactionRespBundle: Bundle = {
  resourceType: "Bundle",
  id: "b2c28be3-8aae-4b3c-b0ff-ca5d0f0b0d1e",
  type: "transaction-response",
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
                      "https://public.metriport.com/fhir/StructureDefinition/operation-outcome",
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
