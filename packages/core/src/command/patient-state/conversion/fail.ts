import { createOrUpdatePatientState } from "../patient-state-store";
import { PatientState, PatientStateKey, Status } from "../types";

export async function failPatientStateConversion({
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
      conversion: {
        status: Status.failed,
        requestId,
        reason: reason ?? "Unknown reason",
      },
    },
  });
}
