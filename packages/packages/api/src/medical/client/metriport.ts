import axios, { AxiosInstance, AxiosStatic } from "axios";

import { Organization } from "../models/organization";
import { PatientLinks, MedicalDataSource } from "../models/link";
import { DocumentReference, documentReferenceSchema } from "../models/document";

export class MetriportMedicalApi {
  readonly api: AxiosInstance;
  private ORGANIZATION_URL = `/organization`;
  private PATIENT_URL = `/patient`;
  private LINK_URL = `/link`;
  private DOCUMENT_URL = `/document`;

  /**
   * Creates a new instance of the Metriport Medical API client.
   *
   * @param {string} apiKey - Your Metriport API key.
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
   * @param {Organization}    organization    - The org you want to create or update
   *
   * @returns The created or updated org.
   */
  async createOrUpdateOrganization(organization: Organization): Promise<Organization> {
    const resp = await this.api.post<Organization>(this.ORGANIZATION_URL, organization);

    if (!resp.data) throw new Error(`Create or update didn't return Organization`);
    return resp.data;
  }

  /**
   * Retrieve an organization
   *
   * @returns The organization or undefined.
   */
  async getOrganization(): Promise<Organization | undefined> {
    const resp = await this.api.get<Organization | undefined>(this.ORGANIZATION_URL);

    if (!resp.data) return undefined;
    return resp.data;
  }

  /**
   * Builds and returns the current state of a patient's links across HIEs.
   *
   * @param {string}    patientId    Patient ID for which to retrieve links.
   *
   * @returns {PatientLinks}         The patient's current and potential links.
   */
  async getLinks(patientId: string): Promise<PatientLinks> {
    const resp = await this.api.get<PatientLinks>(
      `${this.PATIENT_URL}/${patientId}${this.LINK_URL}`
    );

    if (!resp.data) throw new Error(`Get didn't return Links`);
    return resp.data;
  }

  /**
   * Creates link to the specified entity.
   *
   * @param {string}                     patientId    Patient ID for which to retrieve links.
   * @param {string}                     entityId     Entity ID to link to the patient.
   * @param {MedicalDataSource}          linkSource   Data source to link to.
   *
   * @returns link id
   */
  async createLink(
    patientId: string,
    entityId: string,
    linkSource: MedicalDataSource
  ): Promise<string> {
    const resp = await this.api.post<string>(
      `${this.PATIENT_URL}/${patientId}${this.LINK_URL}/${linkSource}`,
      {
        entityId,
      }
    );

    if (!resp.data) throw new Error(`Link not created between patient and entity`);
    return resp.data;
  }

  /**
   * Removes link to the specified entity.
   *
   * @param {string}                     patientId     Patient ID to remove link from.
   * @param {MedicalDataSource}          linkSource    HIE to remove the link from.
   *
   * @returns void
   */
  async removeLink(patientId: string, linkSource: MedicalDataSource): Promise<void> {
    await this.api.delete(`${this.PATIENT_URL}/${patientId}${this.LINK_URL}/${linkSource}`);
  }

  /**
   * Returns document references for the given patient across HIEs.
   *
   * @param patientId Patient ID for which to retrieve document metadata.
   * @param facilityId The facility providing NPI for the document query.
   * @return The metadata of available documents.
   */
  async searchDocuments(patientId: string, facilityId: string): Promise<DocumentReference[]> {
    const resp = await this.api.get(`${this.DOCUMENT_URL}`, {
      params: {
        patientId,
        facilityId,
      },
    });
    if (!resp.data) [];
    return documentReferenceSchema.array().parse(resp.data);
  }

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
