import { Patient } from "@medplum/fhirtypes";
import { makeBaseDomain } from "./shared";

export function makePatient(params: Partial<Patient> = {}): Patient {
  return {
    ...makeBaseDomain(params.id),
    resourceType: "Patient",
    ...params,
  };
}
