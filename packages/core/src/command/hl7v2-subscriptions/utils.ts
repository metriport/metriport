import { compressUuid, packNormalizedId } from "./hl7v2-to-fhir-conversion/shared";

export function createScrambledId(cxId: string, patientId: string): string {
  const compressedCxId = compressUuid(cxId);
  const compressedPatientId = compressUuid(patientId);
  return `${compressedCxId}_${compressedPatientId}`;
}

export function createNoSpecialScrambledId(cxId: string, patientId: string): string {
  const compressedCxId = compressUuid(cxId);
  const compressedPatientId = compressUuid(patientId);

  const normalizedCompressedCxId = packNormalizedId(compressedCxId);
  const normalizedCompressedPatientId = packNormalizedId(compressedPatientId);

  return `${normalizedCompressedCxId}_${normalizedCompressedPatientId}`;
}
