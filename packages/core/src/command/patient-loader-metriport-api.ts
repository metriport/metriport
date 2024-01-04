import axios from "axios";
import { Patient } from "../domain/patient/patient";
import { FindBySimilarity, GetOne, PatientLoader } from "../domain/patient/patient-loader";

/**
 * Implementation of the PatientLoader that calls the Metriport API
 * to execute each its functions.
 */
export class PatientLoaderMetriportAPI implements PatientLoader {
  constructor(private readonly apiUrl: string) {}

  public async getStatesFromPatientIds(cxId: string, patientIds: string[]): Promise<string[]> {
    const resp = await axios.get(`${this.apiUrl}/internal/patient/states`, {
      params: {
        cxId,
        patientIds: patientIds.join(","),
      },
    });
    return resp.data.states;
  }

  // TODO should it be getOneOrFail or just getOne?
  // TODO we should prob do some basic validation here to make sure we got the patient
  async getOneOrFail({ id, cxId }: GetOne): Promise<Patient> {
    const response = await axios.get(`${this.apiUrl}/internal/patient/${id}?cxId=${cxId}`);
    return response.data;
  }

  // TODO we should prob do some basic validation here to make sure we got the patient
  async findBySimilarity({ cxId, data }: FindBySimilarity): Promise<Patient[]> {
    const response = await axios.get(`${this.apiUrl}/internal/patient`, {
      params: {
        cxId: cxId,
        dob: data?.dob,
        genderAtBirth: data?.genderAtBirth,
        firstNameInitial: data?.firstNameInitial,
        lastNameInitial: data?.lastNameInitial,
      },
    });
    return response.data;
  }

  // TODO we should prob do some basic validation here to make sure we got the patient
  async findBySimilarityAcrossAllCxs({ data }: Omit<FindBySimilarity, "cxId">): Promise<Patient[]> {
    const response = await axios.get(`${this.apiUrl}/internal/mpi/patient`, {
      params: {
        dob: data?.dob,
        genderAtBirth: data?.genderAtBirth,
        firstNameInitial: data?.firstNameInitial,
        lastNameInitial: data?.lastNameInitial,
      },
    });
    return response.data;
  }
}
