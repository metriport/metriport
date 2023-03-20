import axios, { AxiosInstance, AxiosStatic } from "axios";
import { BASE_ADDRESS, BASE_ADDRESS_SANDBOX } from "../../shared";

import { documentListSchema, DocumentReference } from "../models/document";
import { Facility, FacilityCreate, facilityListSchema, facilitySchema } from "../models/facility";
import { MedicalDataSource, PatientLinks, patientLinksSchema } from "../models/link";
import { Organization, OrganizationCreate, organizationSchema } from "../models/organization";
import {
  Patient,
  PatientCreate,
  patientListSchema,
  patientSchema,
  PatientUpdate,
} from "../models/patient";

const NO_DATA_MESSAGE = "No data returned from API";
const BASE_PATH = "/medical/v1";

export type Options = {
  axios?: AxiosStatic; // Set axios if it fails to load
} & (
  | {
      sandbox?: boolean;
      baseAddress?: never;
    }
  | {
      sandbox?: never;
      baseAddress?: string;
    }
);

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
  constructor(apiKey: string, options: Options = { sandbox: false }) {
    const headers = { "x-api-key": apiKey };

    const baseURL =
      (options.baseAddress || (options.sandbox ? BASE_ADDRESS_SANDBOX : BASE_ADDRESS)) + BASE_PATH;

    if (axios) {
      this.api = axios.create({
        baseURL,
        headers,
      });
    } else if (options.axios) {
      this.api = options.axios.create({
        baseURL,
        headers,
      });
    } else {
      throw new Error(`Failed to initialize Axios`);
    }
  }

  /**
   * Creates a new organization.
   *
   * @param data The data to be used to create a new organization.
   * @returns The created organization.
   */
  async createOrganization(data: OrganizationCreate): Promise<Organization> {
    const resp = await this.api.post(this.ORGANIZATION_URL, data);
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return organizationSchema.parse(resp.data);
  }

  /**
   * Updates an organization.
   *
   * @param organization The organization data to be updated.
   * @return The updated organization.
   */
  async updateOrganization(organization: Organization): Promise<Organization> {
    type FieldsToOmit = "id";
    const payload: Omit<Organization, FieldsToOmit> & Record<FieldsToOmit, undefined> = {
      ...organization,
      id: undefined,
    };
    const resp = await this.api.put(`${this.ORGANIZATION_URL}/${organization.id}`, payload);
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return organizationSchema.parse(resp.data);
  }

  /**
   * Retrieve an organization representing this account.
   *
   * @returns The organization, or undefined if no organization has been created.
   */
  async getOrganization(): Promise<Organization | undefined> {
    const resp = await this.api.get(this.ORGANIZATION_URL);
    if (!resp.data) return undefined;
    return organizationSchema.parse(resp.data);
  }

  /**
   * Creates a new facility.
   *
   * @param data The data to be used to create a new facility.
   * @return The newly created facility.
   */
  async createFacility(data: FacilityCreate): Promise<Facility> {
    const resp = await this.api.post(`${this.FACILITY_URL}`, data);
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
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
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
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
    const payload: Omit<Facility, FieldsToOmit> & Record<FieldsToOmit, undefined> = {
      ...facility,
      id: undefined,
    };
    const resp = await this.api.put(`${this.FACILITY_URL}/${facility.id}`, payload);
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
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
   * @param facilityId The facility providing the NPI to support this operation.
   * @return The newly created patient.
   */
  async createPatient(data: PatientCreate, facilityId: string): Promise<Patient> {
    const resp = await this.api.post(`${this.PATIENT_URL}`, data, {
      params: { facilityId },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
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
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return patientSchema.parse(resp.data);
  }

  /**
   * Updates a patient at Metriport and at HIEs the patient is linked to.
   *
   * @param patient The patient data to be updated.
   * @param facilityId The facility providing the NPI to support this operation.
   * @return The updated patient.
   */
  async updatePatient(patient: PatientUpdate, facilityId: string): Promise<Patient> {
    type FieldsToOmit = "id";
    const payload: Omit<PatientUpdate, FieldsToOmit> & Record<FieldsToOmit, undefined> = {
      ...patient,
      id: undefined,
    };
    const resp = await this.api.put(`${this.PATIENT_URL}/${patient.id}`, payload, {
      params: { facilityId },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
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
   * Returns the current state of a patient's links across HIEs.
   *
   * @param patientId The ID of the patient for which to retrieve links.
   * @param facilityId The facility providing the NPI to support this operation.
   * @returns The patient's current and potential links.
   */
  async getLinks(patientId: string, facilityId: string): Promise<PatientLinks> {
    const resp = await this.api.get(`${this.PATIENT_URL}/${patientId}${this.LINK_URL}`, {
      params: { facilityId },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return patientLinksSchema.parse(resp.data);
  }

  /**
   * Creates link between a patient at Metriport and an entity (person/patient) on an
   * HIE (medical data source).
   *
   * @param patientId The ID of the patient at Metriport.
   * @param facilityId The facility providing the NPI to support this operation.
   * @param entityId The ID of the entity to link to the patient.
   * @param linkSource The HIE containing the entity to be linked with.
   */
  async createLink(
    patientId: string,
    facilityId: string,
    entityId: string,
    linkSource: MedicalDataSource
  ): Promise<void> {
    await this.api.post(
      `${this.PATIENT_URL}/${patientId}${this.LINK_URL}/${linkSource}`,
      { entityId },
      { params: { facilityId } }
    );
  }

  /**
   * Removes a link between a patient at Metriport and an entity (person/patient) on
   * an HIE (medical data source).
   *
   * @param patientId The ID of the patient at Metriport.
   * @param facilityId The facility providing the NPI to support this operation.
   * @param linkSource The HIE to remove the link from.
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
   * @param facilityId The facility providing the NPI to support this operation.
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
    return documentListSchema.parse(resp.data).documents;
  }

  // TODO #435 review the return type of this function
  /**
   * Returns document references for the given patient across HIEs.
   * Usually called after a successful call to `getDocuments`, which provides
   * a Document location.
   *
   * @param patientId Patient ID for which to retrieve document metadata.
   * @param facilityId The facility providing the NPI to support this operation.
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
