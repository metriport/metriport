import { faker } from "@faker-js/faker";
import { CodeableConcept, Coding, DiagnosticReport } from "@medplum/fhirtypes";
import { makeSubjectReference } from "./shared";

// TODO ENG-835: Put these in a more general place, so it's available for testing other flows as well.
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

export const a1cPanelConceptLoinc = {
  text: "HEMOGLOBIN A1C/HEMOGLOBIN.TOTAL IN BLOOD",
  coding: [
    {
      code: "4548-4",
      display: "HEMOGLOBIN A1C/HEMOGLOBIN.TOTAL IN BLOOD",
      system: "http://loinc.org",
    },
  ],
};

export const metabolicPanelConceptLoinc = {
  text: "Comprehensive metabolic 2000 panel - Serum or Plasma",
  coding: [
    {
      code: "24323-8",
      display: "Comprehensive metabolic 2000 panel - Serum or Plasma",
      system: "http://loinc.org",
    },
  ],
};

export const metabolicPanelConceptOther = {
  text: "Comprehensive metabolic 2000 panel - Serum or Plasma",
  coding: [
    {
      code: "1234",
      display: "Comprehensive metabolic 2000 panel - Serum or Plasma",
      system: "http://terminology.hl7.org/ValueSet/v3-Unknown",
    },
  ],
};
