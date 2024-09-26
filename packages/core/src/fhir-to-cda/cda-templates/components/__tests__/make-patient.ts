import { Patient } from "@medplum/fhirtypes";
import { makeBaseDomain } from "./shared";

export function makePatient(params: Partial<Patient> = {}): Patient {
  return {
    ...makeBaseDomain(),
    resourceType: "Patient",
    ...params,
  };
}
