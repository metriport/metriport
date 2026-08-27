import { createOrUpdatePatientState } from "../patient-state-store";
import { PatientState, PatientStateKey, Status } from "../types";

export async function completePatientStateDq({
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
      dq: {
        status: Status.completed,
        requestId,
      },
    },
    statusCondition: {
      field: "dq",
      operator: "equals",
      value: Status.processing,
    },
  });
}
