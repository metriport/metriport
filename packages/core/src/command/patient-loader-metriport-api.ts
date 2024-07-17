import { PatientDTO, USState } from "@metriport/api-sdk";
import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import { Patient } from "../domain/patient";
import { errorToString } from "../util/error/shared";
import { FindBySimilarity, GetOne, PatientLoader } from "./patient-loader";
import { RDSDataClient, ExecuteStatementCommand, Field } from "@aws-sdk/client-rds-data";
import { getEnvVarOrFail } from "../util/env-var";

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
  // TODO this function is nver used across all PatientLoader im
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
    // tests fail on cicd if I have this at top of file because we cant find the env vars. How do those work??
    const resourceArn = getEnvVarOrFail("DB_RESOURCE_ARN");
    const secretArn = getEnvVarOrFail("DB_SECRET_ARN");
    const region = getEnvVarOrFail("AWS_REGION");
    const rdsDataClient = new RDSDataClient({ region });

    const whereClauses: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parameters: any[] = [];

    if (data.firstNameInitial) {
      whereClauses.push("data->>'firstName' LIKE :firstNameInitial");
      parameters.push({
        name: "firstNameInitial",
        value: { stringValue: `${data.firstNameInitial}%` },
      });
    }
    if (data.lastNameInitial) {
      whereClauses.push("data->>'lastName' LIKE :lastNameInitial");
      parameters.push({
        name: "lastNameInitial",
        value: { stringValue: `${data.lastNameInitial}%` },
      });
    }
    if (data.dob) {
      whereClauses.push("data->>'dob' = :dob");
      parameters.push({ name: "dob", value: { stringValue: data.dob } });
    }
    if (data.genderAtBirth) {
      whereClauses.push("data->>'genderAtBirth' = :genderAtBirth");
      parameters.push({ name: "genderAtBirth", value: { stringValue: data.genderAtBirth } });
    }

    if (whereClauses.length === 0) throw new Error("No search criteria provided");

    const sql = `SELECT cxId, facilityIds, externalId, data FROM patient WHERE ${whereClauses.join(
      " AND "
    )}`;

    try {
      const command = new ExecuteStatementCommand({
        secretArn,
        resourceArn,
        sql,
        parameters,
        includeResultMetadata: true,
        database: "metriport_api",
      });

      const response = await rdsDataClient.send(command);
      console.log("rds http api response", JSON.stringify(response, null, 2));
      const patients = mapRdsResponseToPatients(response.records);
      patients.forEach(validatePatient);
      return patients;
    } catch (error) {
      console.log(`Failing on request to internal endpoint - ${errorToString(error)}`);
      console.log("error", error);
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
function getDomainFromDTO(dto: PatientDTO): Patient {
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

export function mapRdsResponseToPatients(records: Field[][] | undefined): Patient[] {
  if (!records) {
    return [];
  }
  return records.map(record => ({
    id: record?.[0]?.stringValue ?? "",
    cxId: record?.[1]?.stringValue ?? "",
    facilityIds: JSON.parse(record?.[2]?.stringValue ?? "[]"),
    externalId: record?.[3]?.stringValue ?? "",
    data: JSON.parse(record?.[4]?.stringValue ?? "{}"),
    createdAt: new Date(record?.[5]?.stringValue ?? ""),
    updatedAt: new Date(record?.[6]?.stringValue ?? ""),
    eTag: "",
  }));
}
