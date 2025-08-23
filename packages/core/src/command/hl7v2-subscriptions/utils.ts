import { compressUuid } from "./hl7v2-to-fhir-conversion/shared";
import { compressUuidByArn } from "./hl7v2-to-fhir-conversion/shared";

export function createScrambledId(cxId: string, patientId: string): string {
  const compressedCxId = compressUuid(cxId);
  const compressedPatientId = compressUuid(patientId);
  return `${compressedCxId}_${compressedPatientId}`;
}

//Used only by the uploader lambdas.
export async function createScrambledIdByArn(cxId: string, patientId: string): Promise<string> {
  const compressedCxId = await compressUuidByArn(cxId);
  const compressedPatientId = await compressUuidByArn(patientId);
  return `${compressedCxId}_${compressedPatientId}`;
}
