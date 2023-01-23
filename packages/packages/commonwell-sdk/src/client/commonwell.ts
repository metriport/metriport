import axios, { AxiosInstance } from "axios";
import { Agent } from "https";
import { makeJwt } from "../common/make-jwt";
import { PurposeOfUse } from "../models/purpose-of-use";
import { Person, personSchema, PersonSearchResp, personSearchRespSchema } from "../models/person";

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
  static integrationUrl = "https://integration.rest.api.commonwellalliance.org/v1";
  static productionUrl = "https://rest.api.commonwellalliance.org/v1";

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
    const resp = await this.api.post("/person", person, {
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
    const resp = await this.api.get("/person", {
      headers,
      params: { key, system },
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
    const resp = await this.api.post(`/person/${id}`, person, {
      headers,
    });
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
      `/person/${id}/unenroll`,
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
    await this.api.delete(`/person/${id}`, { headers });
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
