import { PatientLoader } from "@metriport/core/domain/patient/patient-loader";
import { getPatientStates } from "../../command/medical/patient/get-patient";

/**
 * Implementation of the PatientLoader that executes the logic within the API (local).
 */
export class PatientLoaderLocal extends PatientLoader {
  public getStatesFromPatientIds(cxId: string, patientIds: string[]): Promise<string[]> {
    return getPatientStates({ cxId, patientIds });
  }
}
