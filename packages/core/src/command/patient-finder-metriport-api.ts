import axios from "axios";
import { PatientFinder, PatientFind } from "../mpi/patient-finder";
import { Patient } from "../domain/patient/patient";

export class PatientFinderMetriportAPI extends PatientFinder {
  constructor(private readonly apiUrl: string) {
    super();
  }
  async find(params: PatientFind): Promise<Patient[]> {
    const response = await axios.get(`${this.apiUrl}/internal/patient/mpi/find`, {
      params: {
        dob: params.data?.dob,
        genderAtBirth: params.data?.genderAtBirth,
        firstNameInitial: params.data?.firstNameInitial,
        lastNameInitial: params.data?.lastNameInitial,
      },
    });
    return response.data;
  }
}
