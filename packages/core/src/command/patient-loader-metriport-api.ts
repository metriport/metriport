import axios from "axios";
import { PatientLoader } from "../domain/patient/patient-loader";

/**
 * Implementation of the PatientLoader that calls the Metriport API
 * to execute each its functions.
 */
export class PatientLoaderMetriportAPI extends PatientLoader {
  constructor(private readonly apiUrl: string) {
    super();
  }

  public async getStatesFromPatientIds(cxId: string, patientIds: string[]): Promise<string[]> {
    const resp = await axios.get(`${this.apiUrl}/internal/patient/states`, {
      params: {
        cxId,
        patientIds: patientIds.join(","),
      },
    });
    return resp.data.states;
  }
}
