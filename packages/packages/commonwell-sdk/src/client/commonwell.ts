import axios, { AxiosInstance } from "axios";
import { Agent } from "https";
import { makeJwt } from "../common/make-jwt";
import { PurposeOfUse } from "../models/purpose-of-use";
import {
  Person,
  personSchema,
  PersonSearchResp,
  personSearchRespSchema,
  PatientLink,
  patientLinkSchema,
} from "../models/person";
import {
  Patient,
  patientSchema,
  PatientSearchResp,
  patientSearchRespSchema,
  patientNetworkLinkRespSchema,
  PatientNetworkLinkResp,
} from "../models/patient";
import { networkLinkSchema, NetworkLink } from "../models/link";
import { Identifier } from "../models/identifier";
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

export class CommonWell {
  static integrationUrl = "https://integration.rest.api.commonwellalliance.org";
  static productionUrl = "https://rest.api.commonwellalliance.org";

  static PERSON_ENDPOINT = "/v1/person";
  static ORG_ENDPOINT = "/v1/org";
  static PATIENT_ENDPOINT = "/v1/patient";

  private api: AxiosInstance;
  private rsaPrivateKey: string;
  private orgName: string;
  private oid: string;
  private httpsAgent: Agent;

  /**
   * Creates a new instance of the CommonWell API client pertaining to an
   * organization to make requests on behalf of.
   *
   * @param orgCert         The certificate (public key) for the organization.
   * @param rsaPrivateKey   An RSA key corresponding to the specified orgCert.
   * @param apiMode         The mode the client will be running.
   */
  constructor(
    orgCert: string,
    rsaPrivateKey: string,
    orgName: string,
    oid: string,
    apiMode: APIMode
  ) {
    this.rsaPrivateKey = rsaPrivateKey;
    this.httpsAgent = new Agent({ cert: orgCert, key: rsaPrivateKey });
    this.api = axios.create({
      baseURL:
        apiMode === APIMode.production ? CommonWell.productionUrl : CommonWell.integrationUrl,
      httpsAgent: this.httpsAgent,
    });
    this.orgName = orgName;
    this.oid = oid;
  }

  // TODO: handle errors in API calls as per
  // https://specification.commonwellalliance.org/services/rest-api-reference (8.6.1 Error)
  // Note that also sometimes these calls 404 when things aren't found and etc

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
   * @param meta    Metadata about the request.
   * @param id      The patient to be updated.
   * @returns
   */
  async searchPersonByPatientDemo(meta: RequestMetadata, id: string): Promise<PersonSearchResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(`${CommonWell.ORG_ENDPOINT}/${this.oid}/patient/${id}/person`, {
      headers,
    });
    return personSearchRespSchema.parse(resp.data);
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
   * Add patient link to person.
   * See: https://specification.commonwellalliance.org/services/patient-identity-and-linking/protocol-operations#8721
   *
   * @param meta    Metadata about the request.
   * @param id      The person id to be link to a patient.
   * @param uri     The patient uri to be link to a person.
   * @returns
   */
  async patientLink(meta: RequestMetadata, id: string, uri: string): Promise<PatientLink> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.post(
      `${CommonWell.PERSON_ENDPOINT}/${id}/patientLink`,
      {
        patient: uri,
      },
      {
        headers,
      }
    );
    return patientLinkSchema.parse(resp.data);
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
    gender: string,
    zip: string
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
   * @param meta    Metadata about the request.
   * @param patient  The data to update.
   * @param id      The patient to be updated.
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
   * @param meta    Metadata about the request.
   * @param id      Patient to be updated.
   * @returns
   */
  async getPatientsLinks(meta: RequestMetadata, id: string): Promise<PatientNetworkLinkResp> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.get(
      `${CommonWell.ORG_ENDPOINT}/${this.oid}/patient/${id}/networkLink`,
      {
        headers,
      }
    );
    return patientNetworkLinkRespSchema.parse(resp.data);
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

    return;
  }

  //--------------------------------------------------------------------------------------------
  // Link Management
  //--------------------------------------------------------------------------------------------

  async upgradeOrDowngradePatientLink(meta: RequestMetadata, href: string): Promise<NetworkLink> {
    const headers = await this.buildQueryHeaders(meta);
    const resp = await this.api.post(
      href,
      {
        proxy: {},
      },
      {
        headers,
      }
    );
    return networkLinkSchema.parse(resp.data);
  }

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

  async deletePatientLink(meta: RequestMetadata, patientLinkUri: string): Promise<void> {
    const headers = await this.buildQueryHeaders(meta);

    await this.api.put(
      `${patientLinkUri}reset`,
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
  private async buildQueryHeaders(meta: RequestMetadata): Promise<{
    [index: string]: string;
  }> {
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
