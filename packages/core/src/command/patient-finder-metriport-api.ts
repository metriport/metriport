import axios from "axios";
import { PatientFinder, PatientFind } from "../mpi/patient-finder";
import { PatientDataMPI } from "../mpi/patient";

export class PatientFinderMetriportAPI extends PatientFinder {
  constructor(private readonly apiUrl: string) {
    super();
  }
  async find(params: PatientFind): Promise<PatientDataMPI[]> {
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
