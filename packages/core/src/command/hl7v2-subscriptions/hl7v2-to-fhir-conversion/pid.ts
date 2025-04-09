import { Hl7Message } from "@medplum/core";
import { MetriportError } from "@metriport/shared";
import { getSegmentByNameOrFail, unpackPidFieldOrFail } from "./shared";

const PID_IDENTIFIER_FIELD = 3;
const IDENTIFIER_COMPONENT = 1;

export function getPatientIdsOrFail(msg: Hl7Message): { cxId: string; patientId: string } {
  const pid = getSegmentByNameOrFail(msg, "PID");
  const idComponent = pid.getComponent(PID_IDENTIFIER_FIELD, IDENTIFIER_COMPONENT);
  const { cxId, patientId } = unpackPidFieldOrFail(idComponent);

  if (!cxId || !patientId) {
    throw new MetriportError("CX ID / Patient ID not found in PID segment");
  }
  return { cxId, patientId };
}
