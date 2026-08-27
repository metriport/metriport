import { getPatientState } from "../get-patient-state";
import { PatientStateKey } from "../types";
import { GetPdParams } from "./types";

export async function getPatientPdState({
  cxId,
  patientId,
  requestId,
  network,
}: PatientStateKey): Promise<GetPdParams | undefined> {
  const existingState = await getPatientState({ patientId, network, requestId, cxId });
  return existingState?.pd;
}
