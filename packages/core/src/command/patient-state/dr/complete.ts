import { createOrUpdatePatientState } from "../patient-state-store";
import { PatientState, PatientStateKey, Status } from "../types";

export async function completePatientStateDr({
  cxId,
  patientId,
  requestId,
  network,
}: PatientStateKey): Promise<PatientState> {
  return createOrUpdatePatientState({
    cxId,
    patientId,
    network,
    requestId,
    state: {
      dr: {
        status: Status.completed,
        requestId,
      },
    },
    statusCondition: {
      field: "dr",
      operator: "notEquals",
      value: Status.completed,
    },
  });
}
