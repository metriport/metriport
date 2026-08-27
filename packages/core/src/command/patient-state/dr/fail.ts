import { createOrUpdatePatientState } from "../patient-state-store";
import { PatientState, PatientStateKey, Status } from "../types";

export async function failPatientStateDr({
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
      dr: {
        status: Status.failed,
        requestId,
        reason: reason ?? "Unknown reason",
      },
    },
  });
}
