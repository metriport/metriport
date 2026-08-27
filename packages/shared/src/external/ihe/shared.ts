import { base64ToString, stringToBase64 } from "../../util/base64";

export function createPatientUniqueId(cxId: string, patientId: string): string {
  return stringToBase64(`${cxId}/${patientId}`);
}

export function extractPatientUniqueId(encodedPatientId: string):
  | {
      cxId: string;
      patientId: string;
    }
  | undefined {
  const decodedString = base64ToString(encodedPatientId);
  const [cxId, patientId] = decodedString.split("/");
  if (!cxId || !patientId) return undefined;
  return { cxId, patientId };
}

export function encodeDocumentId(documentId: string): string {
  return stringToBase64(documentId);
}

export function decodeDocumentId(documentId: string): string {
  return base64ToString(documentId);
}
