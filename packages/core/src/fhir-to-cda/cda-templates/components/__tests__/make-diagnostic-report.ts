import { faker } from "@faker-js/faker";
import { DiagnosticReport } from "@medplum/fhirtypes";
import { makeSubjectReference } from "./shared";

export function makeDiagnosticReport(params: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    ...makeSubjectReference(),
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
