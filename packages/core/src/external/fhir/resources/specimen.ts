import { Specimen } from "@medplum/fhirtypes";

export const SPECIMEN_STATUS_CODES = [
  "entered-in-error",
  "unavailable",
  "unsatisfactory",
  "available",
] as const;

export type SpecimenStatusCode = (typeof SPECIMEN_STATUS_CODES)[number];

export function compareSpecimensByStatus(a: Specimen, b: Specimen): number {
  const aStatus = a.status ?? SPECIMEN_STATUS_CODES[0];
  const bStatus = b.status ?? SPECIMEN_STATUS_CODES[0];
  return SPECIMEN_STATUS_CODES.indexOf(aStatus) - SPECIMEN_STATUS_CODES.indexOf(bStatus);
}
