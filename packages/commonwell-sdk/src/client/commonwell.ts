import axios, { AxiosInstance, AxiosResponse } from "axios";
import httpStatus from "http-status";
import { Agent } from "https";
import * as stream from "stream";
import { PurposeOfUse } from "@metriport/shared";
import { CommonWellAPI } from "..";
import { makeJwt } from "../common/make-jwt";
import MetriportError from "../common/metriport-error";
import { CertificateParam, CertificateResp, certificateRespSchema } from "../models/certificates";
import { DocumentQueryFullResponse, DocumentQueryResponse } from "../models/document";
import { Identifier, StrongId } from "../models/identifier";
import { NetworkLink, networkLinkSchema, PatientLinkProxy } from "../models/link";
import {
  Organization,
  OrganizationList,
  organizationListSchema,
  organizationSchema,
} from "../models/organization";
import {
  Patient,
  PatientLinkResp,
  patientLinkRespSchema,
  PatientNetworkLinkResp,
  patientNetworkLinkRespSchema,
  patientSchema,
  PatientSearchResp,
  patientSearchRespSchema,
} from "../models/patient";
import {
  PatientLink,
  patientLinkSchema,
  PatientLinkSearchResp,
  patientLinkSearchRespSchema,
  Person,
  personSchema,
  PersonSearchResp,
  personSearchRespSchema,
} from "../models/person";
import * as document from "./document";

const DEFAULT_AXIOS_TIMEOUT_SECONDS = 120;

export enum APIMode {
  integration = "integration",
  production = "production",
}

export interface RequestMetadata {
  role: string;
  subjectId: string;
  purposeOfUse: PurposeOfUse;
  npi?: string;
  payloadHash?: string;
}

export class CommonWell implements CommonWellAPI {
  static integrationUrl = "https://integration.rest.api.commonwellalliance.org";
  static productionUrl = "https://rest.api.commonwellalliance.org";

  // V1
  static PERSON_ENDPOINT = "/v1/person";
  static ORG_ENDPOINT = "/v1/org";
  static PATIENT_ENDPOINT = "/v1/patient";
  static MEMBER_ENDPOINT = "/v1/member";
  // V2
  static DOCUMENT_QUERY_ENDPOINT = "/v2/documentReference";

  readonly api: AxiosInstance;
  private rsaPrivateKey: string;
  private orgName: string;
  private _oid: string;
  private httpsAgent: Agent;
  private _lastReferenceHeader: string | undefined;

  /**
   * Creates a new instance of the CommonWell API client pertaining to an
   * organization to make requests on behalf of.
   *
   * @param orgCert         The certificate (public key) for the organization.
   * @param rsaPrivateKey   An RSA key corresponding to the specified orgCert.
   * @param apiMode         The mode the client will be running.
   * @param apiMode         The mode the client will be running.
   * @param options         Optional parameters
   * @param options.timeout Connection timeout in milliseconds, default 120 seconds.
   */
  constructor(
    orgCert: string,
    rsaPrivateKey: string,
    orgName: string,
    oid: string,
    apiMode: APIMode,
    options: { timeout?: number } = {}
  ) {
    this.rsaPrivateKey = rsaPrivateKey;
    this.httpsAgent = new Agent({ cert: orgCert, key: rsaPrivateKey });
    this.api = axios.create({
      timeout: options?.timeout ?? DEFAULT_AXIOS_TIMEOUT_SECONDS * 1_000,
      baseURL:
        apiMode === APIMode.production ? CommonWell.productionUrl : CommonWell.integrationUrl,
      httpsAgent: this.httpsAgent,
    });
    this.api.interceptors.response.use(
      this.axiosSuccessfulResponse(this),
      this.axiosErrorResponse(this)
    );
    this.orgName = orgName;
    this._oid = oid;
  }

  get oid() {
    return this._oid;
  }
  /**
   * Returns the `CW-Reference` header from the last request.
   */
  get lastReferenceHeader(): string | undefined {
    return this._lastReferenceHeader;
  }

  // Being extra safe with these bc a failure here fails the actual request
  private postRequest(response: AxiosResponse): void {
    this._lastReferenceHeader =
      response && response.headers ? response.headers["cw-reference"] : undefined;
  }
  private axiosSuccessfulResponse(_this: CommonWell) {
    return (response: AxiosResponse): AxiosResponse => {
      _this && _this.postRequest(response);
      return response;
    };
  }
  private axiosErrorResponse(_this: CommonWell) {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (error: any): AxiosResponse => {
      _this && _this.postRequest(error.response);
      throw error;
    };
  }

  // TODO: #322 handle errors in API calls as per
  // https://specification.commonwellalliance.org/services/rest-api-reference (8.6.1 Error)
  // Note that also sometimes these calls 404 when things aren't found and etc

  //--------------------------------------------------------------------------------------------
  // Org Management
  //--------------------------------------------------------------------------------------------

  /**
   * Create an org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#post-a-new-organization
   *
   * @param meta          Metadata about the request.
   * @param organization  The org to create.
   * @returns
   */
  async createOrg(meta: RequestMetadata, organization: Organization): Promise<Organization> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.post(
      `${CommonWell.MEMBER_ENDPOINT}/${this.oid}/org`,
      organization,
      {
        headers,
      }
    );
    return organizationSchema.parse(resp.data);
  }

  /**
   * Update an org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#put-new-information-into-an-organization
   *
   * @param meta          Metadata about the request.
   * @param organization  The org to update.
   * @returns
   */
  async updateOrg(
    meta: RequestMetadata,
    organization: Organization,
    id: string
  ): Promise<Organization> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.put(
      `${CommonWell.MEMBER_ENDPOINT}/${this.oid}/org/${id}/`,
      organization,
      {
        headers,
      }
    );
    return organizationSchema.parse(resp.data);
  }

  /**
   * Get list of orgs.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#get-a-list-of-all-organizations
   *
   * @param meta     Metadata about the request.
   * @param summary  Returns only summary data
   * @param offset   Sets an offset number from which recorded returns will begin
   * @param limit    Limits the number of returned records
   * @param sort     Specifies sort order
   * @returns
   */
  async getAllOrgs(
    meta: RequestMetadata,
    summary?: boolean,
    offset?: number,
    limit?: number,
    sort?: string
  ): Promise<OrganizationList> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(`${CommonWell.MEMBER_ENDPOINT}/${this.oid}/org`, {
      headers,
      params: { summary, offset, limit, sort },
    });
    return organizationListSchema.parse(resp.data);
  }

  /**
   * Get one org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#get-a-single-organization
   *
   * @param meta     Metadata about the request.
   * @param id       The org to be found
   * @returns
   */
  async getOneOrg(meta: RequestMetadata, id: string): Promise<Organization | undefined> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(`${CommonWell.MEMBER_ENDPOINT}/${this.oid}/org/${id}/`, {
      headers,
      validateStatus: null, // don't throw on status code > 299
    });
    const status = resp.status;
    if (status === httpStatus.NOT_FOUND) return undefined;
    if (httpStatus[`${status}_CLASS`] === httpStatus.classes.SUCCESSFUL) {
      return organizationSchema.parse(resp.data);
    }
    throw new MetriportError(`Failed to retrieve Organization`, status);
  }

  /**
   * Add certificate to org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#post-new-certificates-to-organizations
   *
   * @param meta         Metadata about the request.
   * @param certificate  The certificate to add to the org
   * @param id           The org to add a certificate too
   * @returns
   */
  async addCertificateToOrg(
    meta: RequestMetadata,
    certificate: CertificateParam,
    id: string
  ): Promise<CertificateResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.post(
      `${CommonWell.MEMBER_ENDPOINT}/${this.oid}/org/${id}/certificate`,
      certificate,
      {
        headers,
      }
    );
    return certificateRespSchema.parse(resp.data);
  }

  /**
   * Replace certificate for org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#put-a-list-of-certificates-into-an-organization
   *
   * @param meta         Metadata about the request.
   * @param certificate  The certificate to replace for the org
   * @param id           The org to replace a certificate for
   * @returns
   */
  async replaceCertificateForOrg(
    meta: RequestMetadata,
    certificate: CertificateParam,
    id: string
  ): Promise<CertificateResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.put(
      `${CommonWell.MEMBER_ENDPOINT}/${this.oid}/org/${id}/certificate`,
      certificate,
      {
        headers,
      }
    );
    return certificateRespSchema.parse(resp.data);
  }

  /**
   * Delete certificate from org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#delete-certificates-by-thumbprint
   *
   * @param meta         Metadata about the request.
   * @param id           The org to delete a certificate from
   * @param thumbprint   The thumbprint from the certificate
   * @param purpose      The purpose from the certificate
   * @returns
   */
  async deleteCertificateFromOrg(
    meta: RequestMetadata,
    id: string,
    thumbprint: string,
    purpose: string
  ): Promise<void> {
    const headers = await this.buildQueryHeaders(meta);
    await this.api.delete(
      `${CommonWell.MEMBER_ENDPOINT}/${this.oid}/org/${id}/certificate/${thumbprint}/purpose/${purpose}`,
      {
        headers,
      }
    );
    return;
  }

  /**
   * Get certificate from org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#get-certificates-for-an-organization
   *
   * @param meta         Metadata about the request.
   * @param certificate  The certificate to add to the org
   * @param id           The org to get a certificate from
   * @param thumbprint   The thumbprint from the certificate
   * @param purpose      The purpose from the certificate
   * @returns
   */
  async getCertificatesFromOrg(
    meta: RequestMetadata,
    id: string,
    thumbprint?: string,
    purpose?: string
  ): Promise<CertificateResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(
      `${CommonWell.MEMBER_ENDPOINT}/${this.oid}/org/${id}/certificate`,
      {
        headers,
        params: { thumbprint, purpose },
      }
    );
    return certificateRespSchema.parse(resp.data);
  }

  /**
   * Get certificate from org (by thumbprint).
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#get-certificates-by-thumbprint
   *
   * @param meta         Metadata about the request.
   * @param certificate  The certificate to add to the org
   * @param id           The org to get a certificate from
   * @param thumbprint   The thumbprint from the certificate
   * @param purpose      The purpose from the certificate
   * @returns
   */
  async getCertificatesFromOrgByThumbprint(
    meta: RequestMetadata,
    id: string,
    thumbprint: string,
    purpose?: string
  ): Promise<CertificateResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(
      `${CommonWell.MEMBER_ENDPOINT}/${this.oid}/org/${id}/certificate/${thumbprint}`,
      {
        headers,
        params: { purpose },
      }
    );
    return certificateRespSchema.parse(resp.data);
  }

  /**
   * Get certificate from org (by thumbprint & purpose).
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#get-certificates-by-thumbprint-and-purpose
   *
   * @param meta         Metadata about the request.
   * @param certificate  The certificate to add to the org
   * @param id           The org to get a certificate from
   * @param thumbprint   The thumbprint from the certificate
   * @param purpose      The purpose from the certificate
   * @returns
   */
  async getCertificatesFromOrgByThumbprintAndPurpose(
    meta: RequestMetadata,
    id: string,
    thumbprint: string,
    purpose: string
  ): Promise<CertificateResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(
      `${CommonWell.MEMBER_ENDPOINT}/${this.oid}/org/${id}/certificate/${thumbprint}/purpose/${purpose}`,
      {
        headers,
      }
    );
    return certificateRespSchema.parse(resp.data);
  }

  //--------------------------------------------------------------------------------------------
  // Person Management
  //--------------------------------------------------------------------------------------------

  /**
   * Enrolls a new person.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8716-adding-a-new-person
   *
   * @param meta    Metadata about the request.
   * @param person  The person to enroll.
   * @returns
   */
  async enrollPerson(meta: RequestMetadata, person: Person): Promise<Person> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.post(CommonWell.PERSON_ENDPOINT, person, {
      headers,
    });
    return personSchema.parse(resp.data);
  }

  /**
   * Searches for a person based on the specified strong ID.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8711-search-for-a-person
   *
   * @param meta    Metadata about the request.
   * @param key     The ID's value, for example the driver's license ID.
   * @param system  The ID's uri to specify type, for example "urn:oid:2.16.840.1.113883.4.3.6" is a CA DL.
   * @returns
   */
  async searchPerson(
    meta: RequestMetadata,
    key: string,
    system: string
  ): Promise<PersonSearchResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(CommonWell.PERSON_ENDPOINT, {
      headers,
      params: { key, system },
    });
    return personSearchRespSchema.parse(resp.data);
  }

  /**
   * Searches for a person based on patient demo.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8713-find-persons-matching-patient-demographics
   *
   * @param meta        Metadata about the request.
   * @param patientId   The patient ID.
   * @returns
   */
  async searchPersonByPatientDemo(
    meta: RequestMetadata,
    patientId: string
  ): Promise<PersonSearchResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(
      `${CommonWell.ORG_ENDPOINT}/${this.oid}/patient/${patientId}/person`,
      {
        headers,
      }
    );
    return personSearchRespSchema.parse(resp.data);
  }

  /**
   * Gets a person based on person id.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8713-find-persons-matching-patient-demographics
   *
   * @param meta        Metadata about the request.
   * @param personId   The person ID.
   * @returns
   */
  async getPersonById(meta: RequestMetadata, personId: string): Promise<Person> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(`${CommonWell.PERSON_ENDPOINT}/${personId}`, {
      headers,
    });
    return personSchema.parse(resp.data);
  }

  /**
   * Updates a person.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8741-updating-person-information
   *
   * @param meta    Metadata about the request.
   * @param person  The data to update.
   * @param id      The person to be updated.
   * @returns
   */
  async updatePerson(meta: RequestMetadata, person: Person, id: string): Promise<Person> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.post(`${CommonWell.PERSON_ENDPOINT}/${id}`, person, {
      headers,
    });
    return personSchema.parse(resp.data);
  }

  /**
   * Matches a person to a patient.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8732-retrieve-patient-matches
   *
   * @param meta    Metadata about the request.
   * @param id      The person to be matched.
   * @returns
   */
  async patientMatch(meta: RequestMetadata, id: string): Promise<PatientSearchResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(`${CommonWell.PERSON_ENDPOINT}/${id}/patientMatch`, {
      headers,
      params: { orgId: this.oid },
    });
    return patientSearchRespSchema.parse(resp.data);
  }

  /**
   * @deprecated use addPatientLink() instead
   */
  async patientLink(
    meta: RequestMetadata,
    personId: string,
    patientUri: string,
    patientStrongId?: StrongId
  ): Promise<PatientLink> {
    return this.addPatientLink(meta, personId, patientUri, patientStrongId);
  }

  /**
   * Add patient link to person.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8721
   *
   * @param meta              Metadata about the request.
   * @param personId          The person id to be link to a patient.
   * @param patientUri        The patient uri to be link to a person.
   * @param [patientStrongId] The patient's strong ID, if available (optional).
   * @returns {PatientLink}
   */
  async addPatientLink(
    meta: RequestMetadata,
    personId: string,
    patientUri: string,
    patientStrongId?: StrongId
  ): Promise<PatientLink> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.post(
      `${CommonWell.PERSON_ENDPOINT}/${personId}/patientLink`,
      {
        patient: patientUri,
        ...(patientStrongId ? { identifier: patientStrongId } : undefined),
      },
      { headers }
    );
    return patientLinkSchema.parse(resp.data);
  }

  /**
   * Re-enrolls a person.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#875-person-unenrollment
   *
   * @param meta    Metadata about the request.
   * @param id      The person to be re-enrolled.
   * @returns       Person with enrollment information
   */
  async reenrollPerson(meta: RequestMetadata, id: string): Promise<Person> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.put(`${CommonWell.PERSON_ENDPOINT}/${id}/enroll`, {}, { headers });
    return personSchema.parse(resp.data);
  }

  /**
   * Unenrolls a person.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#875-person-unenrollment
   *
   * @param meta    Metadata about the request.
   * @param id      The person to be unenrolled.
   * @returns
   */
  async unenrollPerson(meta: RequestMetadata, id: string): Promise<Person> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.put(
      `${CommonWell.PERSON_ENDPOINT}/${id}/unenroll`,
      {},
      {
        headers,
      }
    );
    return personSchema.parse(resp.data);
  }

  /**
   * Deletes a person.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8742-deleting-a-person
   *
   * @param meta    Metadata about the request.
   * @param id      The person to be deleted.
   * @returns
   */
  async deletePerson(meta: RequestMetadata, id: string): Promise<void> {
    const headers = await this.buildQueryHeaders(meta);
    await this.api.delete(`${CommonWell.PERSON_ENDPOINT}/${id}`, { headers });
    return;
  }

  //--------------------------------------------------------------------------------------------
  // Patient Management
  //--------------------------------------------------------------------------------------------

  /**
   * Register a new patient.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8762-adding-a-local-patient-record
   *
   * @param meta    Metadata about the request.
   * @param patient  The patient to register.
   * @returns
   */
  async registerPatient(meta: RequestMetadata, patient: Patient): Promise<Patient> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.post(`${CommonWell.ORG_ENDPOINT}/${this.oid}/patient`, patient, {
      headers,
    });
    return patientSchema.parse(resp.data);
  }

  /**
   * Returns a patient based on its ID.
   *
   * @param meta    Metadata about the request.
   * @param id      Patient's ID.
   * @returns {Promise<Patient>}
   */
  async getPatient(meta: RequestMetadata, id: string): Promise<Patient> {
    const headers = await this.buildQueryHeaders(meta);
    const suffix = id.endsWith("/") ? "" : "/";
    const resp = await this.api.get(
      `${CommonWell.ORG_ENDPOINT}/${this.oid}/patient/${id}${suffix}`,
      { headers }
    );
    return patientSchema.parse(resp.data);
  }

  /**
   * Searches for a patient based on params.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8761-search-for-a-patient
   *
   * @param meta    Metadata about the request.
   * @param fname   Patient's first name.
   * @param lname   Patient's last name.
   * @param dob     Patient's date of birth.
   * @param gender  Patient's gender.
   * @param zip     Patient's zip code.
   * @returns
   */
  async searchPatient(
    meta: RequestMetadata,
    fname: string,
    lname: string,
    dob: string,
    gender?: string,
    zip?: string
  ): Promise<PatientSearchResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(`${CommonWell.ORG_ENDPOINT}/${this.oid}/patient`, {
      headers,
      params: { fname, lname, dob, gender, zip },
    });
    return patientSearchRespSchema.parse(resp.data);
  }

  /**
   * Updates a patient.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8763-updating-a-local-patient-record
   *
   * @param meta     Metadata about the request.
   * @param patient  The data to update.
   * @param id       The patient to be updated.
   * @returns
   */
  async updatePatient(meta: RequestMetadata, patient: Patient, id: string): Promise<Patient> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.post(
      `${CommonWell.ORG_ENDPOINT}/${this.oid}/patient/${id}/`,
      patient,
      {
        headers,
      }
    );
    return patientSchema.parse(resp.data);
  }

  /**
   * Merges patients.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8765-merging-local-patient-records
   *
   * @param meta    Metadata about the request.
   * @param nonSurvivingPatientId  The local Patient Identifier of the non-surviving Patient Record (This patient gets replaced)
   * @param referencePatientLink   The patient link for the patient that will replace the non surviving patient
   * @returns
   */
  async mergePatients(
    meta: RequestMetadata,
    nonSurvivingPatientId: string,
    referencePatientLink: string
  ): Promise<void> {
    const headers = await this.buildQueryHeaders(meta);
    await this.api.put(
      `${CommonWell.ORG_ENDPOINT}/${this.oid}/patient/${nonSurvivingPatientId}/merge`,
      {
        link: {
          other: {
            reference: referencePatientLink,
          },
          type: "replace",
        },
      },
      {
        headers,
      }
    );
    return;
  }

  /**
   * Get Patient's Network Links.
   * See: https://specification.commonwellalliance.org/services/record-locator-service/protocol-operations-record-locator-service#8771-retrieving-network-links
   *
   * @param meta        Metadata about the request.
   * @param patientId   Patient for which to get the network links.
   * @returns
   */
  async getNetworkLinks(meta: RequestMetadata, patientId: string): Promise<PatientNetworkLinkResp> {
    const headers = await this.buildQueryHeaders(meta);
    // Error handling: https://github.com/metriport/metriport-internal/issues/322
    try {
      const resp = await this.api.get(
        `${CommonWell.ORG_ENDPOINT}/${this.oid}/patient/${patientId}/networkLink`,
        {
          headers,
        }
      );
      return patientNetworkLinkRespSchema.parse(resp.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // when there's no NetworkLink, CW's API return 412
      if (err.response?.status === 412) return { _embedded: { networkLink: [] } };
      throw err;
    }
  }

  /**
   * Deletes a patient.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8764-deleting-a-local-patient-record
   *
   * @param meta    Metadata about the request.
   * @param id      The patient to be updated.
   * @returns
   */
  async deletePatient(meta: RequestMetadata, id: string): Promise<void> {
    const headers = await this.buildQueryHeaders(meta);
    await this.api.delete(`${CommonWell.ORG_ENDPOINT}/${this.oid}/patient/${id}/`, {
      headers,
    });
  }

  //--------------------------------------------------------------------------------------------
  // Document Management
  //--------------------------------------------------------------------------------------------

  /**
   * Queries a patient's Documents.
   *
   * @param meta       Metadata about the request.
   * @param patientId  The patient's ID.
   * @returns {Promise<DocumentQueryResponse>}
   * @see {@link https://specification.commonwellalliance.org/services/data-broker/cha-broker-api-reference#104-document-query|Use case}
   * @see {@link https://specification.commonwellalliance.org/services/data-broker/protocol-operations-data-broker#8781-find-documents|API spec}
   */
  async queryDocuments(meta: RequestMetadata, patientId: string): Promise<DocumentQueryResponse> {
    const headers = await this.buildQueryHeaders(meta);
    return document.query(this.api, headers, patientId);
  }

  /**
   * Queries a patient's Documents - including other possible results.
   *
   * @param meta       Metadata about the request.
   * @param patientId  The patient's ID.
   * @returns The DocumentReferences of a patient's available documents and/or OperationOutcomes denoting problems with the query.
   * @see {@link https://specification.commonwellalliance.org/services/data-broker/cha-broker-api-reference#104-document-query|Use case}
   * @see {@link https://specification.commonwellalliance.org/services/data-broker/protocol-operations-data-broker#8781-find-documents|API spec}
   */
  async queryDocumentsFull(
    meta: RequestMetadata,
    patientId: string
  ): Promise<DocumentQueryFullResponse> {
    const headers = await this.buildQueryHeaders(meta);
    return document.queryFull(this.api, headers, patientId);
  }

  /**
   * Retrieve a Document and pipe its bytes into the outputStream.
   *
   * @param {string} inputUrl - The URL of the file to be downloaded.
   * @param {fs.WriteStream} outputStream - The stream to receive the downloaded file's bytes.
   * @returns {Promise<void>}
   * @see {@link https://specification.commonwellalliance.org/services/data-broker/cha-broker-api-reference#106-document-retrieval|Use case}
   * @see {@link https://specification.commonwellalliance.org/services/data-broker/protocol-operations-data-broker#8782-retrieve-document|API spec}
   */
  async retrieveDocument(
    meta: RequestMetadata,
    inputUrl: string,
    outputStream: stream.Writable
  ): Promise<void> {
    const headers = await this.buildQueryHeaders(meta);
    return document.retrieve(this.api, headers, inputUrl, outputStream);
  }

  //--------------------------------------------------------------------------------------------
  // Link Management
  //--------------------------------------------------------------------------------------------

  /**
   * Upgrade or downgrade network link.
   * See: https://specification.commonwellalliance.org/services/record-locator-service/protocol-operations-record-locator-service#8772-upgrading-a-network-link
   *
   * @param meta    Metadata about the request.
   * @param href    The href of network link to be upgraded or downgraded
   * @param proxy   The proxy for the patient link action.
   * @returns
   */
  async upgradeOrDowngradeNetworkLink(
    meta: RequestMetadata,
    href: string,
    proxy?: PatientLinkProxy
  ): Promise<NetworkLink> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.post(
      href,
      {
        proxy,
      },
      {
        headers,
      }
    );
    return networkLinkSchema.parse(resp.data);
  }

  /**
   * Update a patient link.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8722-updating-a-patient-link
   *
   * @param meta              Metadata about the request.
   * @param patientLinkUri    The uri of patient link to be updated
   * @param patientUri        The uri of patient that belongs to this link
   * @param identifier        Add identifier information to the patient link
   * @returns
   */
  async updatePatientLink(
    meta: RequestMetadata,
    patientLinkUri: string,
    patientUri?: string,
    identifier?: Identifier
  ): Promise<PatientLink> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.post(
      patientLinkUri,
      {
        patient: patientUri,
        identifier: identifier,
      },
      {
        headers,
      }
    );

    return patientLinkSchema.parse(resp.data);
  }

  /**
   * Get a person's links to patients.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8721
   *
   * @param meta                Metadata about the request.
   * @param personId            The person id to be link to a patient.
   * @param [limitToOrg=true]   Whether to limit the search to the current organization (optional).
   * @returns Response with list of links to Patients
   */
  async getPatientLinks(
    meta: RequestMetadata,
    personId: string,
    limitToOrg = true
  ): Promise<PatientLinkSearchResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(`${CommonWell.PERSON_ENDPOINT}/${personId}/patientLink`, {
      headers,
      params: {
        ...(limitToOrg ? { orgId: this.oid } : undefined),
      },
    });
    return patientLinkSearchRespSchema.parse(resp.data);
  }

  /**
   * Gets a patient link.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8723-getting-a-patient-link
   *
   * @param meta              Metadata about the request.
   * @param personId          Person that is linked
   * @param patientId         Patient that is linked
   * @returns
   */
  async getPatientLink(
    meta: RequestMetadata,
    personId: string,
    patientId: string
  ): Promise<PatientLinkResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(`/v1/person/${personId}/patientLink/${patientId}/`, {
      headers,
    });

    return patientLinkRespSchema.parse(resp.data);
  }

  /**
   * Deletes a patient link - the link will be moved to LOLA 0 and cannot be used again.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8724-deleting-a-patient-link
   *
   * WARNING: This shouldn't be used except under the explicit request of a person.
   *
   * @param meta              Metadata about the request.
   * @param patientLinkUri    The uri of patient link to be deleted
   * @returns
   */
  async deletePatientLink(meta: RequestMetadata, patientLinkUri: string): Promise<void> {
    const headers = await this.buildQueryHeaders(meta);

    await this.api.delete(patientLinkUri, {
      headers,
    });

    return;
  }

  /**
   * Resets a patient link - the link will be moved to LOLA 1 and can be relinked later.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8725-resetting-a-patient-link
   *
   * @param meta              Metadata about the request.
   * @param personId          Person that is linked
   * @param patientId         Patient that is linked
   * @returns
   */
  async resetPatientLink(
    meta: RequestMetadata,
    personId: string,
    patientId: string
  ): Promise<void> {
    const headers = await this.buildQueryHeaders(meta);

    await this.api.put(
      `/v1/person/${personId}/patientLink/${patientId}/reset`,
      {},
      {
        headers,
      }
    );

    return;
  }

  //--------------------------------------------------------------------------------------------
  // Private Methods
  //--------------------------------------------------------------------------------------------
  private async buildQueryHeaders(meta: RequestMetadata): Promise<Record<string, string>> {
    const jwt = await makeJwt(
      this.rsaPrivateKey,
      meta.role,
      meta.subjectId,
      this.orgName,
      this.oid,
      meta.purposeOfUse,
      meta.npi,
      meta.payloadHash
    );
    return { Authorization: `Bearer ${jwt}` };
  }
}
