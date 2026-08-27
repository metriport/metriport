import { createOrUpdatePatientState } from "../patient-state-store";
import { PatientState, PatientStateKey, Status } from "../types";

export async function completePatientStatePd({
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
      pd: {
        status: Status.completed,
        requestId,
        rerunPdOnNewDemographics: false,
      },
    },
  });
}
