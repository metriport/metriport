import { Immunization } from "@medplum/fhirtypes";

export const immunizationFlu: Partial<Immunization> = {
  status: "completed",
  vaccineCode: {
    coding: [
      {
        system: "http://hl7.org/fhir/sid/cvx",
        code: "140",
        display: "Influenza, seasonal, injectable, preservative free",
      },
    ],
    text: "Influenza, seasonal, injectable, preservative free",
  },
  patient: {
    reference: "Patient/018ef2b1-a952-7a43-9124-7a86f10b9d78",
  },
  encounter: {
    reference: "Encounter/90170bdf-3029-49d9-ba31-48c942bf3799",
  },
  occurrenceDateTime: "2013-09-19T18:14:30-07:00",
  primarySource: true,
};
