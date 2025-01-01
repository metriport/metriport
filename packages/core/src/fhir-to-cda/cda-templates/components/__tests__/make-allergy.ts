import { AllergyIntolerance } from "@medplum/fhirtypes";
import { makeReference } from "../../../../external/fhir/__tests__/reference";
import { allergyMedication } from "./allergy-examples";
import { makePatient } from "./make-patient";
import { makeBaseDomain } from "./shared";

export function makeAllergy(params: Partial<AllergyIntolerance> = {}): AllergyIntolerance {
  return {
    ...makeBaseDomain(),
    resourceType: "AllergyIntolerance",
    patient: makeReference(makePatient(params.patient?.id ? { id: params.patient.id } : {})),
    ...params,
  };
}

export function makeAllergyMedication(
  params: Partial<AllergyIntolerance> = {}
): AllergyIntolerance {
  return makeAllergy({
    ...allergyMedication,
    ...params,
  });
}
