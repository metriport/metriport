import axios, { AxiosInstance, AxiosStatic } from "axios";

import { DocumentReference, documentReferenceSchema } from "../models/document";
import { Facility, FacilityCreate, facilityListSchema, facilitySchema } from "../models/facility";
import { MedicalDataSource, PatientLinks } from "../models/link";
import { Organization } from "../models/organization";
import {
  Patient,
  PatientCreate,
  patientListSchema,
  patientSchema,
  PatientUpdate,
} from "../models/patient";

export class MetriportMedicalApi {
  readonly api: AxiosInstance;
  private ORGANIZATION_URL = `/organization`;
  private FACILITY_URL = `/facility`;
  private PATIENT_URL = `/patient`;
  private LINK_URL = `/link`;
  private DOCUMENT_URL = `/document`;

  /**
   * Creates a new instance of the Metriport Medical API client.
   *
   * @param apiKey Your Metriport API key.
   */
  constructor(
    apiKey: string,
    baseURL = "https://api.metriport.com/medical/v1",
    secondaryAxios?: AxiosStatic
  ) {
    const headers = { "x-api-key": apiKey };

    if (axios) {
      this.api = axios.create({
        baseURL,
        headers,
      });
    } else if (secondaryAxios) {
      this.api = secondaryAxios.create({
        baseURL,
        headers,
      });
    } else {
      throw new Error(`Failed to initialize Axios`);
    }
  }

  /**
   * Creates an org or updates one if it already exists
   *
   * @param organization The org you want to create or update
   * @returns The created or updated org.
   */
  async createOrUpdateOrganization(organization: Organization): Promise<Organization> {
    const resp = await this.api.post<Organization>(this.ORGANIZATION_URL, organization);
    if (!resp.data) throw new Error(`Create or update didn't return Organization`);
    return resp.data;
  }

  /**
   * Retrieve an organization representing this account.
   *
   * @returns The organization, or undefined if no organization has been created.
   */
  async getOrganization(): Promise<Organization | undefined> {
    const resp = await this.api.get<Organization | undefined>(this.ORGANIZATION_URL);
    if (!resp.data) return undefined;
    return resp.data;
  }

  /**
   * Creates a new facility.
   *
   * @param data The data to be used to create a new facility.
   * @return The newly created facility.
   */
  async createFacility(data: FacilityCreate): Promise<Facility> {
    const resp = await this.api.post(`${this.FACILITY_URL}`, data);
    if (!resp.data) throw new Error(`Did not receive a facility from the server`);
    return facilitySchema.parse(resp.data);
  }

  /**
   * Returns a facility.
   *
   * @param id The ID of the facility to be returned.
   * @return The facilities.
   */
  async getFacility(id: string): Promise<Facility> {
    const resp = await this.api.get(`${this.FACILITY_URL}/${id}`);
    if (!resp.data) throw new Error(`Did not receive a facility from the server`);
    return facilitySchema.parse(resp.data);
  }

  /**
   * Updates a facility.
   *
   * @param facility The facility data to be updated.
   * @return The updated facility.
   */
  async updateFacility(facility: Facility): Promise<Facility> {
    type FieldsToOmit = "id";
    const payload: Omit<Facility, FieldsToOmit> & Partial<Pick<Facility, FieldsToOmit>> = {
      ...facility,
      id: undefined,
    };
    const resp = await this.api.put(`${this.FACILITY_URL}/${facility.id}`, payload);
    if (!resp.data) throw new Error(`Did not receive a facility from the server`);
    return facilitySchema.parse(resp.data);
  }

  /**
   * Returns the facilities associated with this account.
   *
   * @return The list of facilities.
   */
  async listFacilities(): Promise<Facility[]> {
    const resp = await this.api.get(`${this.FACILITY_URL}`);
    if (!resp.data) [];
    return facilityListSchema.parse(resp.data).facilities;
  }

  /**
   * Creates a new patient at Metriport and HIEs.
   *
   * @param data The data to be used to create a new patient.
   * @param facilityId The ID of the facility to provide the NPI to create the patient.
   * @return The newly created patient.
   */
  async createPatient(data: PatientCreate, facilityId: string): Promise<Patient> {
    const resp = await this.api.post(`${this.PATIENT_URL}`, data, {
      params: { facilityId },
    });
    if (!resp.data) throw new Error(`Did not receive a patient from the server`);
    return patientSchema.parse(resp.data);
  }

  /**
   * Returns a patient.
   *
   * @param id The ID of the patient to be returned.
   * @return The patients.
   */
  async getPatient(id: string): Promise<Patient> {
    const resp = await this.api.get(`${this.PATIENT_URL}/${id}`);
    if (!resp.data) throw new Error(`Did not receive a patient from the server`);
    return patientSchema.parse(resp.data);
  }

  /**
   * Updates a patient at Metriport and at HIEs the patient is linked to.
   *
   * @param patient The patient data to be updated.
   * @param facilityId The ID of the facility to provide the NPI to update the patient.
   * @return The updated patient.
   */
  async updatePatient(patient: PatientUpdate, facilityId: string): Promise<Patient> {
    type FieldsToOmit = "id" | "facilityIds";
    const payload: Omit<Patient, FieldsToOmit> & Partial<Pick<Patient, FieldsToOmit>> = {
      ...patient,
      id: undefined,
      facilityIds: undefined,
    };
    const resp = await this.api.put(`${this.PATIENT_URL}/${patient.id}`, payload, {
      params: { facilityId },
    });
    if (!resp.data) throw new Error(`Did not receive a patient from the server`);
    return patientSchema.parse(resp.data);
  }

  /**
   * Returns the patients associated with given facility.
   *
   * @param facilityId The ID of the facility.
   * @return The list of patients.
   */
  async listPatients(facilityId: string): Promise<Patient[]> {
    const resp = await this.api.get(`${this.PATIENT_URL}`, {
      params: { facilityId },
    });
    if (!resp.data) [];
    return patientListSchema.parse(resp.data).patients;
  }

  /**
   * Builds and returns the current state of a patient's links across HIEs.
   *
   * @param patientId Patient ID for which to retrieve links.
   * @param facilityId The ID of the facility to provide the NPI to get links for patient.
   * @returns The patient's current and potential links.
   */
  async getLinks(patientId: string, facilityId: string): Promise<PatientLinks> {
    const resp = await this.api.get<PatientLinks>(
      `${this.PATIENT_URL}/${patientId}${this.LINK_URL}`,
      {
        params: { facilityId },
      }
    );

    if (!resp.data) throw new Error(`Get didn't return Links`);
    return resp.data;
  }

  /**
   * Creates link to the specified entity.
   *
   * @param patientId Patient ID for which to retrieve links.
   * @param facilityId The ID of the facility to provide the NPI to create link for patient.
   * @param entityId Entity ID to link to the patient.
   * @param linkSource Data source to link to.
   * @returns link id
   */
  async createLink(
    patientId: string,
    facilityId: string,
    entityId: string,
    linkSource: MedicalDataSource
  ): Promise<string> {
    const resp = await this.api.post<string>(
      `${this.PATIENT_URL}/${patientId}${this.LINK_URL}/${linkSource}`,
      {
        entityId,
      },
      {
        params: { facilityId },
      }
    );

    if (!resp.data) throw new Error(`Link not created between patient and entity`);
    return resp.data;
  }

  /**
   * Removes link to the specified entity.
   *
   * @param patientId Patient ID to remove link from.
   * @param facilityId The ID of the facility to provide the NPI to remove link from patient.
   * @param linkSource HIE to remove the link from.
   * @returns void
   */
  async removeLink(
    patientId: string,
    facilityId: string,
    linkSource: MedicalDataSource
  ): Promise<void> {
    await this.api.delete(`${this.PATIENT_URL}/${patientId}${this.LINK_URL}/${linkSource}`, {
      params: { facilityId },
    });
  }

  /**
   * Returns document references for the given patient across HIEs.
   *
   * @param patientId Patient ID for which to retrieve document metadata.
   * @param facilityId The facility providing NPI for the document query.
   * @return The metadata of available documents.
   */
  async listDocuments(patientId: string, facilityId: string): Promise<DocumentReference[]> {
    const resp = await this.api.get(`${this.DOCUMENT_URL}`, {
      params: {
        patientId,
        facilityId,
      },
    });
    if (!resp.data) [];
    return documentReferenceSchema.array().parse(resp.data);
  }

  // TODO #435 review the return type of this function
  /**
   * Returns document references for the given patient across HIEs.
   * Usually called after a successful call to `getDocuments`, which provides
   * a Document location.
   *
   * @param patientId Patient ID for which to retrieve document metadata.
   * @param facilityId The facility providing NPI for the document query.
   * @param location The location of the document.
   * @return The document's contents (bytes).
   */
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getDocument(patientId: string, facilityId: string, location: string): Promise<any> {
    const resp = await this.api.get(`${this.DOCUMENT_URL}/download`, {
      params: {
        patientId,
        facilityId,
        location,
      },
      responseType: "blob",
    });
    return resp.data;
  }
}
