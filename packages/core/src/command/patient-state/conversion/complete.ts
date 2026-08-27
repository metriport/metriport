import { createOrUpdatePatientState } from "../patient-state-store";
import { PatientState, PatientStateKey, Status } from "../types";

export async function completePatientStateConversion({
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
      conversion: {
        status: Status.completed,
        requestId,
      },
    },
    statusCondition: {
      field: "conversion",
      operator: "notEquals",
      value: Status.completed,
    },
  });
}
