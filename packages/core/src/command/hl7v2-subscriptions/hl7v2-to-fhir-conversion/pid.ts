import { Hl7Message } from "@medplum/core";
import { getSegmentByNameOrFail, unpackPidFieldOrFail } from "./shared";

const PID_IDENTIFIER_FIELD = 3;
const IDENTIFIER_COMPONENT = 1;

export function getPatientIdsOrFail(msg: Hl7Message): { cxId: string; patientId: string } {
  const pid = getSegmentByNameOrFail(msg, "PID");
  const idComponent = pid.getComponent(PID_IDENTIFIER_FIELD, IDENTIFIER_COMPONENT);
  return unpackPidFieldOrFail(idComponent);
}
