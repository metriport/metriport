import { createOrUpdatePatientState } from "../patient-state-store";
import { PatientState, PatientStateKey, Status } from "../types";

export async function failPatientStateDq({
  cxId,
  patientId,
  requestId,
  network,
  reason,
}: PatientStateKey): Promise<PatientState> {
  return createOrUpdatePatientState({
    cxId,
    patientId,
    network,
    requestId,
    state: {
      dq: {
        status: Status.failed,
        requestId,
        reason: reason ?? "Unknown reason",
      },
    },
  });
}
