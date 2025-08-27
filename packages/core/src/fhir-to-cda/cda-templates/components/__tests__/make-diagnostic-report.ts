import { faker } from "@faker-js/faker";
import {
  Attachment,
  CodeableConcept,
  Coding,
  DiagnosticReport,
  Observation,
  Reference,
} from "@medplum/fhirtypes";
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

export function makePresentedFormExample(): Attachment[] {
  return [
    {
      contentType: "text/html",
      data: "some b-64 encoded data",
    },
  ];
}

export function makePresentedFormExample2(): Attachment[] {
  return [
    {
      contentType: "text/html",
      data: "some other b-64 encoded data",
    },
  ];
}

export function makeResultExample(): Reference<Observation>[] {
  return [
    {
      reference: "Observation/some-obs-ID",
    },
  ];
}

export function makeResultExmplae2(): Reference<Observation>[] {
  return [
    {
      reference: "Observation/some-obs-ID-2",
    },
  ];
}

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

export function makeA1cConcept(): CodeableConcept {
  return {
    text: "HEMOGLOBIN A1C/HEMOGLOBIN.TOTAL IN BLOOD",
    coding: [
      {
        code: "4548-4",
        display: "HEMOGLOBIN A1C/HEMOGLOBIN.TOTAL IN BLOOD",
        system: "http://loinc.org",
      },
    ],
  };
}

export function makeMetabolicPanelConceptLoinc(): CodeableConcept {
  return {
    text: "Comprehensive metabolic 2000 panel - Serum or Plasma",
    coding: [
      {
        code: "24323-8",
        display: "Comprehensive metabolic 2000 panel - Serum or Plasma",
        system: "http://loinc.org",
      },
    ],
  };
}

export function makeMetabolicPanelConceptOther(): CodeableConcept {
  return {
    text: "Comprehensive metabolic 2000 panel - Serum or Plasma",
    coding: [
      {
        code: "1234",
        display: "Comprehensive metabolic 2000 panel - Serum or Plasma",
        system: "http://terminology.hl7.org/ValueSet/v3-Unknown",
      },
    ],
  };
}
