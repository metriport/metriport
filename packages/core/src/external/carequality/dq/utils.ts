import { XDSUnknownPatientId } from "../error";
import { extractPatientUniqueId } from "../shared";

export function decodePatientId(patientIdB64: string): { cxId: string; id: string } | undefined {
  const decodedString = extractPatientUniqueId(patientIdB64);
  const [cxId, id] = decodedString.split("/");

  if (!cxId || !id) {
    throw new XDSUnknownPatientId("Patient ID is not valid");
  }
  return { cxId, id };
}
