import { PatientDTO } from "@metriport/api-sdk";
import { executeWithNetworkRetries, USState } from "@metriport/shared";
import axios from "axios";
import { Patient } from "../domain/patient";
import { errorToString } from "../util/error/shared";
import { FindBySimilarity, GetOne, PatientLoader } from "./patient-loader";

/**
 * Implementation of the PatientLoader that calls the Metriport API
 * to execute each its functions.
 */
export class PatientLoaderMetriportAPI implements PatientLoader {
  constructor(private readonly apiUrl: string) {}

  public async getStatesFromPatientIds(cxId: string, patientIds: string[]): Promise<string[]> {
    const resp = await executeWithNetworkRetries(
      () =>
        axios.get(`${this.apiUrl}/internal/patient/states`, {
          params: {
            cxId,
            patientIds: patientIds.join(","),
          },
        }),
      { retryOnTimeout: true }
    );
    return resp.data.states;
  }

  // TODO: Response is DTO not domain object
  async getOneOrFail({ id, cxId }: GetOne): Promise<Patient> {
    const response = await executeWithNetworkRetries(
      () => axios.get(`${this.apiUrl}/internal/patient/${id}?cxId=${cxId}`),
      { retryOnTimeout: true }
    );
    const patient = getDomainFromDTO(response.data);
    validatePatient(patient);
    return patient;
  }

  // TODO: Response is DTO not domain object
  async findBySimilarity({ cxId, data }: FindBySimilarity): Promise<Patient[]> {
    const response = await executeWithNetworkRetries(
      () =>
        axios.get(`${this.apiUrl}/internal/patient`, {
          params: {
            cxId: cxId,
            dob: data?.dob,
            genderAtBirth: data?.genderAtBirth,
            firstNameInitial: data?.firstNameInitial,
            lastNameInitial: data?.lastNameInitial,
          },
        }),
      { retryOnTimeout: true }
    );
    const patients: Patient[] = response.data.map((patient: PatientDTO) =>
      getDomainFromDTO(patient)
    );
    patients.forEach(validatePatient);
    return patients;
  }

  async findBySimilarityAcrossAllCxs({ data }: Omit<FindBySimilarity, "cxId">): Promise<Patient[]> {
    try {
      const response = await executeWithNetworkRetries(
        () =>
          axios.get(`${this.apiUrl}/internal/mpi/patient`, {
            params: {
              dob: data?.dob,
              genderAtBirth: data?.genderAtBirth,
              firstNameInitial: data?.firstNameInitial,
              lastNameInitial: data?.lastNameInitial,
            },
          }),
        { retryOnTimeout: true }
      );
      // call convertToDomainObject(response) here
      const patients: Patient[] = response.data.map((patient: PatientDTO) =>
        getDomainFromDTO(patient)
      );
      patients.forEach(validatePatient);
      return patients;
    } catch (error) {
      console.log(`Failing on request to internal endpoint - ${errorToString(error)}`);
      throw error;
    }
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

//
export function getDomainFromDTO(dto: PatientDTO): Patient {
  return {
    id: dto.id,
    eTag: dto.eTag ?? "",
    cxId: "",
    createdAt: dto.dateCreated ?? new Date(),
    updatedAt: dto.dateCreated ?? new Date(),
    facilityIds: dto.facilityIds,
    externalId: dto.externalId ?? "",
    data: {
      firstName: dto.firstName,
      lastName: dto.lastName,
      dob: dto.dob,
      genderAtBirth: dto.genderAtBirth,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personalIdentifiers: dto.personalIdentifiers?.map((identifier: any) => ({
        type: identifier.type,
        value: identifier.value,
        state: identifier.state,
      })),
      address: dto.address
        ? (Array.isArray(dto.address) ? dto.address : [dto.address]).map(addr => ({
            ...addr,
            state: addr.state as USState,
          }))
        : [],
      contact: dto.contact ? (Array.isArray(dto.contact) ? dto.contact : [dto.contact]) : [],
    },
  };
}
