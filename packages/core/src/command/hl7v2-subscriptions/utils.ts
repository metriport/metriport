import { compressUuid } from "./hl7v2-to-fhir-conversion/shared";

export function createScrambledId(cxId: string, patientId: string): string {
  const compressedCxId = compressUuid(cxId);
  const compressedPatientId = compressUuid(patientId);
  return `${compressedCxId}_${compressedPatientId}`;
}

export function createNoSpecialScrambledId(cxId: string, patientId: string): string {
  const compressedCxId = compressUuid(cxId);
  const compressedPatientId = compressUuid(patientId);

  const normalizedCompressedCxId = compressedCxId
    .replace(/_/g, "")
    .replace(/=/g, ".")
    .replace(/\+/g, "|");
  const normalizedCompressedPatientId = compressedPatientId
    .replace(/_/g, "")
    .replace(/=/g, ".")
    .replace(/\+/g, "|");

  return `${normalizedCompressedCxId}_${normalizedCompressedPatientId}`;
}
