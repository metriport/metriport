import { createOrUpdatePatientState } from "../patient-state-store";
import { PatientState, PatientStateKey, Status } from "../types";

export async function failPatientStatePd({
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
      pd: {
        status: Status.failed,
        requestId,
        rerunPdOnNewDemographics: false,
        reason: reason ?? "Unknown reason",
      },
    },
  });
}
