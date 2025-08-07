import { Coding } from "@medplum/fhirtypes";
import { LOINC_CODE, LOINC_OID } from "./constants";

export function isLoinc(system: string | undefined): boolean {
  if (
    system?.toLowerCase().trim().includes(LOINC_CODE) ||
    system?.toLowerCase().trim().includes(LOINC_OID)
  ) {
    return true;
  }
  return false;
}

export function isLoincCoding(coding: Coding | undefined): boolean {
  if (isLoinc(coding?.system)) {
    return true;
  }
  return false;
}
