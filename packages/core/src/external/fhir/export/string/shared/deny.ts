import {
  ICD_9_CODE,
  ICD_10_CODE,
  SNOMED_CODE,
  LOINC_CODE,
  RXNORM_CODE,
  NDC_CODE,
  CVX_CODE,
  CPT_CODE,
} from "../../../../../util/constants";

export const denyTextExact = ["UNK", "NI", "Note", "History and physical note"];
export const denyTextContains = ["Unknown", "Not Identified", "No data"].map(deny =>
  deny.toLowerCase()
);

const allowedSystems = [
  RXNORM_CODE,
  NDC_CODE,
  CPT_CODE,
  CVX_CODE,
  ICD_10_CODE,
  ICD_9_CODE,
  LOINC_CODE,
  SNOMED_CODE,
].map(code => code.toLowerCase());

// TODO rename to emptyIfDenied
export function checkDeny(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (denyTextExact.includes(v)) return undefined;
  if (denyTextContains.some(deny => v.toLowerCase().includes(deny))) return undefined;
  return value;
}

export function isAllowedSystem(value: string | undefined): boolean {
  if (!value) return true;
  return allowedSystems.some(system => value.toLowerCase().includes(system));
}
