import { faker } from "@faker-js/faker";
import { CodeableConcept, Coding, DiagnosticReport } from "@medplum/fhirtypes";
import { makeSubjectReference } from "./shared";

export function makeDiagnosticReport(
  params: Partial<DiagnosticReport> = {},
  patientId?: string
): DiagnosticReport {
  return {
    ...makeSubjectReference(patientId),
    resourceType: "DiagnosticReport",
    ...(params.id ? { id: params.id } : { id: faker.string.uuid() }),
    code: params.code ?? {
      coding: [
        {
          system: "http://loinc.org",
          code: "34109-9",
          display: "Note",
        },
      ],
    },
    ...params,
  };
}

export const presentedFormExample = [
  {
    contentType: "text/html",
    data: "some b-64 encoded data",
  },
];

export const resultExample = [
  {
    reference: "Observation/some-obs-ID",
  },
];

export function makeDiagnosticReportCategory(
  coding: Coding = {
    code: "30954-2",
    display: "Relevant diagnostic tests/laboratory data Narrative",
    system: "http://loinc.org",
  }
): CodeableConcept {
  return {
    coding: [coding],
  };
}
