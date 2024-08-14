import { Medication } from "@medplum/fhirtypes";

export function makeMedication(params: Partial<Medication> = {}): Medication {
  return {
    ...(params.id ? { id: params.id } : {}),
    resourceType: "Medication",
    code: params.code ?? {
      coding: [
        {
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          code: "198440",
        },
        {
          system: "http://hl7.org/fhir/sid/ndc",
          code: "10135-144-05",
        },
      ],
      text: "acetaminophen (TYLENOL) 500 mg tablet",
    },
    ...params,
  };
}
