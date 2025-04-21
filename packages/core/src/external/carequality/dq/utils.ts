import { isValidUuid } from "../../../util/uuid-v7";
import { XDSUnknownPatientId } from "../error";
import { extractPatientUniqueId } from "../shared";

export function decodePatientId(patientIdB64: string): { cxId: string; patientId: string } {
  const decodedString = extractPatientUniqueId(patientIdB64);
  const [cxId, patientId] = decodedString.split("/");

  if (!cxId || !patientId || !isValidUuid(cxId) || !isValidUuid(patientId)) {
    throw new XDSUnknownPatientId("Patient ID is not valid");
  }
  return { cxId, patientId };
}
