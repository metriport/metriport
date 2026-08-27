import { isValidUuid } from "../../../util/uuid-v7";
import { XDSUnknownPatientId } from "../error";
import { extractPatientUniqueId } from "@metriport/shared";

export function decodePatientId(patientIdB64: string): { cxId: string; patientId: string } {
  const { cxId, patientId } = extractPatientUniqueId(patientIdB64) ?? {};

  if (!cxId || !patientId || !isValidUuid(cxId) || !isValidUuid(patientId)) {
    throw new XDSUnknownPatientId("Patient ID is not valid");
  }
  return { cxId, patientId };
}
