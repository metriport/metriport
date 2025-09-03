import { CodeableConcept } from "@medplum/fhirtypes";
import { PRACTITIONER_ROLE_URL } from "@metriport/shared/medical";

export const PRACTITIONER_ROLE_CODES = [
  "doctor",
  "nurse",
  "pharmacist",
  "researcher",
  "teacher",
  "ict",
] as const;
export type PractitionerRoleCode = (typeof PRACTITIONER_ROLE_CODES)[number];
export const practitionerRoleDisplay: Record<PractitionerRoleCode, string> = {
  doctor: "Doctor",
  nurse: "Nurse",
  pharmacist: "Pharmacist",
  researcher: "Researcher",
  teacher: "Teacher/educator",
  ict: "ICT professional",
};

export function getPractitionerRoleCode(code: PractitionerRoleCode): CodeableConcept {
  return {
    coding: [
      {
        system: PRACTITIONER_ROLE_URL,
        code,
        display: practitionerRoleDisplay[code],
      },
    ],
  };
}
