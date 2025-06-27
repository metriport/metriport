import { defaultOptionsRequestNotAccepted, executeWithNetworkRetries } from "@metriport/shared";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import httpStatus from "http-status";
import { Agent } from "https";
import * as stream from "stream";
import { CommonwellError } from "../common/commonwell-error";
import { downloadFile } from "../common/fileDownload";
import { makeJwt } from "../common/make-jwt";
import {
  buildBaseQueryMeta,
  convertPatientIdToSubjectId,
  encodeToCwPatientId,
} from "../common/util";
import { DocumentQueryResponse, documentQueryResponseSchema } from "../models/document";
import {
  Patient,
  PatientCollection,
  patientCollectionSchema,
  PatientLinkResp,
  patientLinkRespSchema,
  PatientLinkSearchResp,
  patientLinkSearchRespSchema,
  PatientMergeResponse,
  patientMergeResponseSchema,
} from "../models/patient";
import {
  APIMode,
  CommonWellOptions,
  defaultOnError500,
  DEFAULT_AXIOS_TIMEOUT_SECONDS,
  OnError500Options,
} from "./common";
import {
  BaseOptions,
  CommonWellAPI,
  DocumentQueryParams,
  GetPatientParams,
  OrganizationRequestMetadata,
} from "./commonwell-api";

/**
 * Implementation of the CommonWell API, v4.
 * @see https://www.commonwellalliance.org/wp-content/uploads/2025/06/Services-Specification-v4.3-Approved-2025.06.03-1.pdf
 */
export class CommonWell implements CommonWellAPI {
  static integrationUrl = "https://api.integration.commonwellalliance.lkopera.com";
  static productionUrl = "https://api.commonwellalliance.lkopera.com";

  readonly api: AxiosInstance;
  private rsaPrivateKey: string;
  private orgName: string;
  private _oid: string;
  private _npi: string;
  private httpsAgent: Agent;
  private _lastTransactionId: string | undefined;
  private onError500: OnError500Options;

  /**
   * Creates a new instance of the CommonWell API client pertaining to an
   * organization to make requests on behalf of.
   *
   * @param orgCert         The certificate (public key) for the organization.
   * @param rsaPrivateKey   An RSA key corresponding to the specified orgCert.
   * @param orgName         The name of the organization.
   * @param oid             The OID of the organization.
   * @param npi             The NPI of the organization.
   * @param apiMode         The mode the client will be running.
   * @param options         Optional parameters
   * @param options.timeout Connection timeout in milliseconds, default 120 seconds.
   */
  constructor({
    orgCert,
    rsaPrivateKey,
    orgName,
    oid,
    npi,
    apiMode,
    options = {},
  }: {
    orgCert: string;
    rsaPrivateKey: string;
    orgName: string;
    oid: string;
    npi: string;
    apiMode: APIMode;
    options?: CommonWellOptions;
  }) {
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
    this._npi = npi;
    this.onError500 = { ...defaultOnError500, ...options.onError500 };
  }

  get oid() {
    return this._oid;
  }
  get npi() {
    return this._npi;
  }
  /**
   * Returns the transaction ID from the last request.
   */
  get lastTransactionId(): string | undefined {
    return this._lastTransactionId;
  }

  // Being extra safe with these bc a failure here fails the actual request
  private postRequest(response: AxiosResponse): void {
    this._lastTransactionId =
      response && response.headers ? response.headers["x-trace-id"] : undefined;
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

  //--------------------------------------------------------------------------------------------
  // Patient Management
  //--------------------------------------------------------------------------------------------

  /**
   * Register a new patient.
   *
   * @param patient  The patient to register.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns The patient collection containing the patient in the first position.
   */
  async createOrUpdatePatient(patient: Patient, options?: BaseOptions): Promise<PatientCollection> {
    const headers = await this.buildQueryHeaders(options?.meta);
    const url = buildPatientEndpoint(this.oid);
    const resp = await this.api.post(url, patient, { headers });
    // console.log(`>>> RESPONSE RAW: ${JSON.stringify(resp.data, null, 2)}`);
    return patientCollectionSchema.parse(resp.data);
  }

  /**
   * Returns a patient based on its ID.
   *
   * @param params The patient ID and optional assign authority and assign authority type.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns The patient collection containing the patient in the first position.
   */
  async getPatient(params: GetPatientParams, options?: BaseOptions): Promise<PatientCollection>;
  /**
   * Returns a patient based on its ID.
   *
   * @param id      Patient's ID, unencoded.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns The patient collection containing the patient in the first position.
   */
  async getPatient(id: string, options?: BaseOptions): Promise<PatientCollection>;
  async getPatient(
    idOrParams: string | GetPatientParams,
    options?: BaseOptions
  ): Promise<PatientCollection> {
    let patientId: string;
    if (typeof idOrParams !== "string") {
      patientId = idOrParams.id;
      const { assignAuthority, assignAuthorityType } = idOrParams;
      patientId = encodeToCwPatientId({
        patientId,
        assignAuthority,
        assignAuthorityType,
      });
    } else {
      if (!idOrParams) {
        throw new Error("Programming error, 'id' is rquired when providing separated parametrs");
      }
      patientId = idOrParams;
    }
    const headers = await this.buildQueryHeaders(options?.meta);
    const url = buildPatientEndpoint(this.oid, patientId);
    const resp = await this.executeWithRetriesOn500IfEnabled(() => this.api.get(url, { headers }));
    // console.log(`>>> RESPONSE RAW: ${JSON.stringify(resp.data, null, 2)}`);
    return patientCollectionSchema.parse(resp.data);
  }

  // TODO ENG-200 See "10.2.3 Patient Match"
  /**
   * Searches for a patient based on params.
   *
   * @param meta    Metadata about the request.
   * @param fname   Patient's first name.
   * @param lname   Patient's last name.
   * @param dob     Patient's date of birth.
   * @param gender  Patient's gender.
   * @param zip     Patient's zip code.
   * @returns
   */
  // async searchPatient(
  //   meta: RequestMetadata,
  //   fname: string,
  //   lname: string,
  //   dob: string,
  //   gender?: string,
  //   zip?: string
  // ): Promise<PatientSearchResp> {
  //   const headers = await this.buildQueryHeaders(meta);
  //   const resp = await this.executeWithRetriesOn500(() =>
  //     this.api.get(`${CommonWell.ORG_ENDPOINT}/${this.oid}/patient`, {
  //       headers,
  //       params: { fname, lname, dob, gender, zip },
  //     })
  //   );
  //   return patientSearchRespSchema.parse(resp.data);
  // }

  /**
   * Merges patients.
   *
   * @param nonSurvivingPatientId The local Patient ID of the non-surviving Patient Record (This patient gets replaced).
   * @param survivingPatientId The patient ID of the patient that will replace the non surviving patient
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns The patient merge response.
   */
  async mergePatients(
    {
      nonSurvivingPatientId,
      survivingPatientId,
    }: {
      nonSurvivingPatientId: string;
      survivingPatientId: string;
    },
    options?: BaseOptions
  ): Promise<PatientMergeResponse> {
    const headers = await this.buildQueryHeaders(options?.meta);
    const url = buildPatientMergeEndpoint(this.oid, nonSurvivingPatientId);
    const resp = await this.executeWithRetriesOn500IfEnabled(() =>
      this.api.put(
        url,
        {
          link: {
            other: {
              reference: `Patient/${survivingPatientId}`,
            },
            type: "replaced-by",
          },
        },
        {
          headers,
        }
      )
    );
    // console.log(`>>> RESPONSE RAW: ${JSON.stringify(resp.data, null, 2)}`);
    return patientMergeResponseSchema.parse(resp.data);
  }

  /**
   * Get Patient's Network Links.
   *
   * @param meta        Metadata about the request.
   * @param patientId   Patient for which to get the network links.
   * @returns
   */
  // async getNetworkLinks(meta: RequestMetadata, patientId: string): Promise<PatientNetworkLinkResp> {
  //   const headers = await this.buildQueryHeaders(meta);
  //   // Error handling: https://github.com/metriport/metriport-internal/issues/322
  //   try {
  //     const resp = await this.executeWithRetriesOn500(() =>
  //       this.api.get(`${CommonWell.ORG_ENDPOINT}/${this.oid}/patient/${patientId}/networkLink`, {
  //         headers,
  //       })
  //     );
  //     return patientNetworkLinkRespSchema.parse(resp.data);
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   } catch (err: any) {
  //     // when there's no NetworkLink, CW's API return 412
  //     if (err.response?.status === 412) return { _embedded: { networkLink: [] } };
  //     throw err;
  //   }
  // }

  /**
   * Deletes a patient.
   *
   * @param patientId The patient to be deleted.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   */
  async deletePatient(patientId: string, options?: BaseOptions): Promise<void> {
    const headers = await this.buildQueryHeaders(options?.meta);
    const url = buildPatientEndpoint(this.oid, patientId);
    await this.executeWithRetriesOn500IfEnabled(() => this.api.delete(url, { headers }));
  }

  //--------------------------------------------------------------------------------------------
  // Document Management
  //--------------------------------------------------------------------------------------------

  /**
   * Queries a patient's Documents.
   *
   * @param patientId The patient's ID.
   * @param options Query parameters and query parameters.
   * @param options.status The status of the document. Defaults to `current`, even if a param is
   *                      provided without status.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns a Bundle containing DocumentReferences FHIR resources in the entry array.
   */
  async queryDocuments(
    patientId: string,
    options?: BaseOptions & DocumentQueryParams
  ): Promise<DocumentQueryResponse> {
    const { meta, ...params } = options ?? {};
    const headers = await this.buildQueryHeaders(meta);
    const actualParams = {
      ...params,
      status: options?.status ?? "current",
    };
    const subjectId = convertPatientIdToSubjectId(patientId);
    if (!subjectId) {
      throw new CommonwellError(`Could not determine subject ID for document query`, undefined, {
        patientId,
      });
    }
    const url = buildDocumentQueryUrl(subjectId, actualParams);
    const response = await this.executeWithRetriesOn500IfEnabled(() =>
      this.api.get(url, { headers })
    );
    console.log(`>>> RESPONSE RAW: ${JSON.stringify(response.data, null, 2)}`);
    return documentQueryResponseSchema.parse(response.data);
  }

  // TODO ENG-200 Decide if we need this
  /**
   * Queries a patient's Documents - including other possible results.
   *
   * @param meta       Metadata about the request.
   * @param patientId  The patient's ID.
   * @returns The DocumentReferences of a patient's available documents and/or OperationOutcomes denoting problems with the query.
   */
  // async queryDocumentsFull(
  //   meta: RequestMetadata,
  //   patientId: string
  // ): Promise<DocumentQueryFullResponse> {
  //   const headers = await this.buildQueryHeaders(meta);
  //   return this.executeWithRetriesOn500(() => document.queryFull(this.api, headers, patientId));
  // }

  /**
   * Retrieve a Document and pipe its bytes into the outputStream.
   *
   * @param inputUrl The URL of the file to be downloaded.
   * @param outputStream The stream to receive the downloaded file's bytes.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   */
  async retrieveDocument(
    inputUrl: string,
    outputStream: stream.Writable,
    options?: BaseOptions
  ): Promise<void> {
    const headers = await this.buildQueryHeaders(options?.meta);
    await this.executeWithRetriesOn500IfEnabled(() =>
      downloadFile({
        url: inputUrl,
        outputStream,
        client: this.api,
        headers,
      })
    );
  }

  //--------------------------------------------------------------------------------------------
  // Link Management
  //--------------------------------------------------------------------------------------------

  // TODO ENG-200 address this
  /**
   * Upgrade or downgrade network link.
   * See: https://specification.commonwellalliance.org/services/record-locator-service/protocol-operations-record-locator-service#8772-upgrading-a-network-link
   *
   * @param meta    Metadata about the request.
   * @param href    The href of network link to be upgraded or downgraded
   * @param proxy   The proxy for the patient link action.
   * @returns
   */
  // async upgradeOrDowngradeNetworkLink(
  //   href: string,
  //   proxy?: PatientLinkProxy,
  //   options?: BaseOptions
  // ): Promise<NetworkLink> {
  //   const meta = options?.meta ?? buildOrganizationQueryMeta(this.orgName, this.npi);
  //   const headers = await this.buildQueryHeaders(meta);
  //   const resp = await this.executeWithRetriesOn500(() =>
  //     this.api.post(href, { proxy }, { headers })
  //   );
  //   return networkLinkSchema.parse(resp.data);
  // }

  // TODO ENG-200 address this
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
  // async updatePatientLink(
  //   meta: RequestMetadata,
  //   patientLinkUri: string,
  //   patientUri?: string,
  //   identifier?: Identifier
  // ): Promise<PatientLink> {
  //   const headers = await this.buildQueryHeaders(meta);
  //   const resp = await this.executeWithRetriesOn500(() =>
  //     this.api.post(
  //       patientLinkUri,
  //       {
  //         patient: patientUri,
  //         identifier: identifier,
  //       },
  //       {
  //         headers,
  //       }
  //     )
  //   );

  //   return patientLinkSchema.parse(resp.data);
  // }

  /**
   * An Edge System can search and request Patient Links by a local patient identifier. The result of the query will
   * include local and remote patient's links that are autolinked by the rules engine or manually linked.
   * The links returned are confirmed links of LOLA 2 or higher.
   * @see: https://www.commonwellalliance.org/wp-content/uploads/2025/06/Services-Specification-v4.3-Approved-2025.06.03-1.pdf
   *
   * @param meta                Metadata about the request.
   * @param patientId            The person id to be link to a patient.
   * @param [limitToOrg=true]   Whether to limit the search to the current organization (optional).
   * @returns Response with list of links to Patients
   */
  async getPatientLinksByPatientId(
    patientId: string,
    options?: BaseOptions
  ): Promise<PatientLinkSearchResp> {
    const headers = await this.buildQueryHeaders(options?.meta);
    const url = buildPatientLinkEndpoint(this.oid, patientId);
    const resp = await this.executeWithRetriesOn500IfEnabled(() => this.api.get(url, { headers }));
    // console.log(`>>> RESPONSE RAW: ${JSON.stringify(resp.data, null, 2)}`);
    return patientLinkSearchRespSchema.parse(resp.data);
  }
  // TODO Can this be used to search??
  // TODO Can this be used to search??
  // TODO Can this be used to search??
  /**
   * OrgId = Unique Organization OID
   * fname = Patient's First Name
   * lname = Patient's Last Name
   * dob = Patient's Date of Birth in yyyy-MM-dd format
   * gender = Patient's Gender [possible values: M (Male); F (Female); U (Unknown); O (Other)]
   * zip = Patient's ZIP code
   * ***Fname, Lname, DOB, and zip are required parameters to get links for a specific patient.
   */
  // async getPatientLinksByPatientDemo(
  //   meta: RequestMetadata,
  //   patientId: string
  //   // limitToOrg = true
  // ): Promise<PatientLinkSearchResp> {
  //   const headers = await this.buildQueryHeaders(meta);
  //   const url = CommonWell.getPatientEndpoint(this.oid);
  //   const resp = await this.executeWithRetriesOn500(() =>
  //     this.api.get(`${url}/${patientId}`, { headers })
  //   );
  //   const resp = await this.executeWithRetriesOn500(() =>
  //     this.api.get(`${CommonWell.PERSON_ENDPOINT}/${patientId}/patientLink`, {
  //       headers,
  //       params: {
  //         ...(limitToOrg ? { orgId: this.oid } : undefined),
  //       },
  //     })
  //   );
  //   return patientLinkSearchRespSchema.parse(resp.data);
  // }

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
    personId: string,
    patientId: string,
    options?: BaseOptions
  ): Promise<PatientLinkResp> {
    const headers = await this.buildQueryHeaders(options?.meta);
    const resp = await this.executeWithRetriesOn500IfEnabled(() =>
      this.api.get(`/v1/person/${personId}/patientLink/${patientId}/`, {
        headers,
      })
    );

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
  async deletePatientLink(patientLinkUri: string, options?: BaseOptions): Promise<void> {
    const headers = await this.buildQueryHeaders(options?.meta);
    await this.executeWithRetriesOn500IfEnabled(() =>
      this.api.post(patientLinkUri, {}, { headers })
    );
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
    personId: string,
    patientId: string,
    options?: BaseOptions
  ): Promise<void> {
    const headers = await this.buildQueryHeaders(options?.meta);
    await this.executeWithRetriesOn500IfEnabled(() =>
      this.api.put(
        `/v1/person/${personId}/patientLink/${patientId}/reset`,
        {},
        {
          headers,
        }
      )
    );

    return;
  }

  // TODO ENG-200 need to add DOA here?
  private async buildQueryHeaders(
    metaParam: OrganizationRequestMetadata | undefined
  ): Promise<Record<string, string>> {
    const meta = metaParam ?? this.buildOrganizationQueryMeta();
    const jwt = await makeJwt({
      rsaPrivateKey: this.rsaPrivateKey,
      role: meta.role,
      subjectId: meta.subjectId,
      orgName: this.orgName,
      oid: this.oid,
      purposeOfUse: meta.purposeOfUse,
      npi: meta.npi,
      payloadHash: meta.payloadHash,
    });
    return { Authorization: `Bearer ${jwt}` };
  }

  private buildOrganizationQueryMeta(): OrganizationRequestMetadata {
    const base = buildBaseQueryMeta(this.orgName);
    return { ...base, npi: this.npi };
  }

  private async executeWithRetriesOn500IfEnabled<T>(fn: () => Promise<T>): Promise<T> {
    return this.onError500.retry
      ? executeWithNetworkRetries(fn, {
          ...this.onError500,
          httpCodesToRetry: [...defaultOptionsRequestNotAccepted.httpCodesToRetry],
          httpStatusCodesToRetry: [
            ...defaultOptionsRequestNotAccepted.httpStatusCodesToRetry,
            httpStatus.INTERNAL_SERVER_ERROR,
          ],
        })
      : fn();
  }
}

function buildOrgEndpoint(orgId: string) {
  return `/v2/org/${orgId}`;
}

function buildPatientEndpoint(orgId: string, patientId?: string) {
  return `${buildOrgEndpoint(orgId)}/Patient${patientId ? `/${patientId}` : ""}`;
}

function buildPatientLinkEndpoint(orgId: string, patientId: string) {
  return `${buildOrgEndpoint(orgId)}/PatientLink/${patientId}`;
}

function buildPatientMergeEndpoint(orgId: string, nonSurvivingPatientId: string) {
  return `${buildPatientEndpoint(orgId, nonSurvivingPatientId)}/Merge`;
}

function buildDocumentQueryUrl(subjectId: string, params: DocumentQueryParams): string {
  const urlParams = new URLSearchParams();
  urlParams.append("subject.id", subjectId);
  if (params.status) urlParams.append("status", params.status);
  if (params.author?.given) urlParams.append("author.given", params.author.given);
  if (params.author?.family) urlParams.append("author.family", params.author.family);
  if (params.period?.start) urlParams.append("period.start", params.period.start);
  if (params.period?.end) urlParams.append("period.end", params.period.end);
  if (params.date?.start) urlParams.append("date.start", params.date.start);
  if (params.date?.end) urlParams.append("date.end", params.date.end);
  return `/v2/R4/DocumentReference?${urlParams.toString()}`;
}
