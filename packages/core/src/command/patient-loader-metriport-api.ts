import axios from "axios";
import { Patient } from "../domain/patient";
import { FindBySimilarity, GetOne, PatientLoader } from "../domain/patient-loader";

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

  async getOneOrFail({ id, cxId }: GetOne): Promise<Patient> {
    const response = await axios.get(`${this.apiUrl}/internal/patient/${id}?cxId=${cxId}`);
    validatePatient(response.data);
    return response.data;
  }

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
    validatePatient(response.data);
    return response.data;
  }

  async findBySimilarityAcrossAllCxs({ data }: Omit<FindBySimilarity, "cxId">): Promise<Patient[]> {
    const response = await axios.get(`${this.apiUrl}/internal/mpi/patient`, {
      params: {
        dob: data?.dob,
        genderAtBirth: data?.genderAtBirth,
        firstNameInitial: data?.firstNameInitial,
        lastNameInitial: data?.lastNameInitial,
      },
    });
    validatePatient(response.data);
    return response.data;
  }
}

function validatePatient(patient: Patient): boolean {
  if (!patient) {
    throw new Error("Patient object is not defined");
  }
  if (!patient.id) {
    throw new Error("Patient ID is not defined");
  }
  if (!patient.data.firstName) {
    throw new Error("Patient name is not defined");
  }
  if (!patient.data.lastName) {
    throw new Error("Patient last name is not defined");
  }
  if (!patient.data.dob) {
    throw new Error("Patient birth date is not defined");
  }
  if (!patient.data.genderAtBirth) {
    throw new Error("Patient gender is not defined");
  }
  return true;
}
