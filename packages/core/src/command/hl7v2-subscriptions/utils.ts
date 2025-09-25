import { compressUuid, createBambooId } from "./hl7v2-to-fhir-conversion/shared";

export function createScrambledId(cxId: string, patientId: string): string {
  const compressedCxId = compressUuid(cxId);
  const compressedPatientId = compressUuid(patientId);
  return `${compressedCxId}_${compressedPatientId}`;
}

export function createBambooScrambledId(cxId: string, patientId: string): string {
  const compressedCxId = compressUuid(cxId);
  const compressedPatientId = compressUuid(patientId);

  const normalizedCompressedCxId = createBambooId(compressedCxId);
  const normalizedCompressedPatientId = createBambooId(compressedPatientId);

  return `${normalizedCompressedCxId}_${normalizedCompressedPatientId}`;
}
