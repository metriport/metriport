import {
  base64ToBuffer,
  defaultOptionsRequestNotAccepted,
  executeWithNetworkRetries,
  MetriportError,
} from "@metriport/shared";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import httpStatus from "http-status";
import { Agent } from "https";
import * as stream from "stream";
import { CommonwellError } from "../common/commonwell-error";
import { downloadFileInMemory } from "../common/fileDownload";
import { makeJwt } from "../common/make-jwt";
import {
  buildBaseQueryMeta,
  convertPatientIdToSubjectId,
  encodeToCwPatientId,
} from "../common/util";
import { normalizeDatetime } from "../models/date";
import { fhirGenderToCommonwell } from "../models/demographics";
import {
  DocumentQueryFullResponse,
  documentQueryFullResponseSchema,
  documentQueryResponseSchema,
  DocumentReference,
} from "../models/document";
import {
  Patient,
  PatientCollection,
  PatientCollectionItem,
  patientCollectionSchema,
  PatientProbableLinkResp,
  patientProbableLinkRespSchema,
  StatusResponse,
  statusResponseSchema,
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
  RetrieveDocumentResponse,
} from "./commonwell-api";

/**
 * Implementation of the CommonWell API, v4.
 * @see https://www.commonwellalliance.org/specification/
 */
export class CommonWell implements CommonWellAPI {
  static integrationUrl = "https://api.integration.commonwellalliance.lkopera.com";
  static productionUrl = "https://api.commonwellalliance.lkopera.com";

  readonly api: AxiosInstance;
  private rsaPrivateKey: string;
  private _orgName: string;
  private _oid: string;
  private _npi: string;
  private _homeCommunityId: string;
  private httpsAgent: Agent;
  private _lastTransactionId: string | undefined;
  private onError500: OnError500Options;

  /**
   * Creates a new instance of the CommonWell API client pertaining to an
   * organization to make requests on behalf of.
   */
  constructor({
    orgCert,
    rsaPrivateKey,
    orgName,
    oid,
    npi,
    homeCommunityId,
    apiMode,
    options = {},
  }: {
    /** The certificate (public key) for the organization. */
    orgCert: string;
    /** An RSA key corresponding to the specified orgCert. */
    rsaPrivateKey: string;
    /** The name of the organization that's making the request, the Principal or Delegate. */
    orgName: string;
    /** The OID of the organization that's making the request, the Principal or Delegate. */
    oid: string;
    /** The NPI of the organization that's making the request, the Principal or Delegate. */
    npi: string;
    /**
     * The Home Community OID assigned to the Organization that is initiating the request,
     * the implementor.
     */
    homeCommunityId: string;
    /** The mode the client will be running. */
    apiMode: APIMode;
    /** Optional parameters. */
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
    this._orgName = orgName;
    this._oid = oid;
    this._npi = npi;
    this._homeCommunityId = homeCommunityId;
    this.onError500 = { ...defaultOnError500, ...options.onError500 };
  }

  get oid() {
    return this._oid;
  }
  get npi() {
    return this._npi;
  }
  get orgName() {
    return this._orgName;
  }
  get homeCommunityId() {
    return this._homeCommunityId;
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
    const headers = this.buildQueryHeaders(options?.meta);
    const url = buildPatientEndpoint(this.oid);
    const normalizedPatient = normalizePatient(patient);
    const resp = await this.api.post(url, normalizedPatient, { headers });
    return patientCollectionSchema.parse(resp.data);
  }

  /**
   * Returns a patient based on its ID.
   *
   * @param params The patient ID and optional assign authority and assign authority type.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns The patient collection containing the patient in the first position.
   * @throws MetriportError if multiple patients are found for the given ID.
   */
  async getPatient(
    params: GetPatientParams,
    options?: BaseOptions
  ): Promise<PatientCollectionItem | undefined>;
  /**
   * Returns a patient based on its ID.
   *
   * @param id      Patient's ID, unencoded.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns The patient collection containing the patient in the first position.
   * @throws MetriportError if multiple patients are found for the given ID.
   */
  async getPatient(id: string, options?: BaseOptions): Promise<PatientCollectionItem | undefined>;
  async getPatient(
    idOrParams: string | GetPatientParams,
    options?: BaseOptions
  ): Promise<PatientCollectionItem | undefined> {
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
    const headers = this.buildQueryHeaders(options?.meta);
    const url = buildPatientEndpoint(this.oid, patientId);
    const resp = await this.executeWithRetriesOn500IfEnabled(() => this.api.get(url, { headers }));
    const collection = patientCollectionSchema.parse(resp.data);
    if (collection.Patients.length > 1) {
      throw new MetriportError("Multiple patients found for the given ID", undefined, {
        patientId,
        count: collection.Patients.length,
      });
    }
    return collection.Patients[0];
  }

  /**
   * Deletes a patient.
   *
   * @param patientId The patient to be deleted.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   */
  async deletePatient(patientId: string, options?: BaseOptions): Promise<void> {
    const headers = this.buildQueryHeaders(options?.meta);
    const url = buildPatientEndpoint(this.oid, patientId);
    await this.executeWithRetriesOn500IfEnabled(() => this.api.delete(url, { headers }));
  }

  //--------------------------------------------------------------------------------------------
  // Link Management
  //--------------------------------------------------------------------------------------------

  /**
   * Merges two patients into one.
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
  ): Promise<StatusResponse> {
    const headers = this.buildQueryHeaders(options?.meta);
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
    return statusResponseSchema.parse(resp.data);
  }

  /**
   * Returns the links the patient has with other patients.
   *
   * An Edge System can search and request Patient Links by a local patient identifier. The result of the query will
   * include local and remote patient's links that are autolinked by the rules engine or manually linked.
   *
   * The links returned are confirmed links of LOLA 2 or higher.
   *
   * @param meta                Metadata about the request.
   * @param patientId            The person id to be link to a patient.
   * @returns Response with list of links to Patients
   */
  async getPatientLinksByPatientId(
    patientId: string,
    options?: BaseOptions
  ): Promise<PatientCollection> {
    const headers = this.buildQueryHeaders(options?.meta);
    const url = buildPatientLinkEndpoint(this.oid, patientId);
    const resp = await this.executeWithRetriesOn500IfEnabled(() => this.api.get(url, { headers }));
    return patientCollectionSchema.parse(resp.data);
  }

  /**
   * Returns the potential links the patient has. Those are links the CommonWell MPI was not
   * confident enough to confirm (LOLA2+), but could potentially be a match in case some of
   * the patient's demographics have changed.
   *
   * An Edge System can request probable patient links by a local patient identifier. MPI will identify probable
   * patients based on MPI match scores that are within a certain threshold range but are not auto matched.
   * Probable matches are determined by probabilistic algorithms. This will enable Edge Systems to confirm
   * additional patient matches across other organizations. On confirmation, the patient will be matched to a
   * person. Probable links need to be manually linked to the local patient before documents can be requested.
   *
   * The links returned are LOLA 1.
   *
   * @param patientId The ID of the patient to get probable links for.
   * @returns Response with list of probable (LOLA1) links to other Patients
   */
  async getProbableLinksById(
    patientId: string,
    options?: BaseOptions
  ): Promise<PatientProbableLinkResp> {
    const headers = this.buildQueryHeaders(options?.meta);
    const url = buildProbableLinkEndpoint(this.oid, patientId);
    const resp = await this.executeWithRetriesOn500IfEnabled(() => this.api.get(url, { headers }));
    return patientProbableLinkRespSchema.parse(resp.data);
  }

  /**
   * Returns the potential links for a patient with the provided demographics.
   *
   * An Edge System can request probable patient links by a local patient identifier. MPI will identify probable
   * patients based on MPI match scores that are within a certain threshold range but are not auto matched.
   * Probable matches are determined by probabilistic algorithms. This will enable Edge Systems to confirm
   * additional patient matches across other organizations. On confirmation, the patient will be matched to a
   * person. Probable links need to be manually linked to the local patient before documents can be requested.
   *
   * The links returned are LOLA 1.
   *
   * @param firstName The first name of the patient.
   * @param lastName The last name of the patient.
   * @param dob The date of birth of the patient.
   * @param gender The gender of the patient.
   * @param zip The zip code of the patient.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns Response with list of probable (LOLA1) links to existing Patients
   */
  async getProbableLinksByDemographics(
    {
      firstName,
      lastName,
      dob,
      gender,
      zip,
    }: {
      firstName: string;
      lastName: string;
      dob: string;
      gender: string;
      zip: string;
    },
    options?: BaseOptions
  ): Promise<PatientProbableLinkResp> {
    const headers = this.buildQueryHeaders(options?.meta);
    const params = new URLSearchParams();
    params.append("fname", firstName);
    params.append("lname", lastName);
    params.append("dob", dob);
    params.append("gender", fhirGenderToCommonwell(gender));
    params.append("zip", zip);
    const url = buildProbableLinkEndpoint(this.oid);
    const resp = await this.executeWithRetriesOn500IfEnabled(() =>
      this.api.get(url + `?${params.toString()}`, { headers })
    );
    return patientProbableLinkRespSchema.parse(resp.data);
  }

  /**
   * An Edge System reviews the probable matches. An Edge System can link remote patient(s) if these patients are
   * the same as local patient.
   *
   * Use getPatientLinksByPatientId to get the Link URL.
   *
   * Remote patients will be linked with the local patient and now considered as a manual confirmed LOLA 2 link.
   *
   * @param urlToLinkPatients The URL to link the patients.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   */
  async linkPatients(urlToLinkPatients: string, options?: BaseOptions): Promise<StatusResponse> {
    const headers = this.buildQueryHeaders(options?.meta);
    const resp = await this.executeWithRetriesOn500IfEnabled(() =>
      this.api.put(urlToLinkPatients, {}, { headers })
    );
    return statusResponseSchema.parse(resp.data);
  }

  /**
   * After reviewing remote patient links for their local patient, an Edge System can unlink a remote patient that
   * does not belong in the Patient collection and remove the existing LOLA2 network link.
   *
   * Use getPatientLinksByPatientId to get the Unlink URL.
   *
   * Patient Links that are manually unlinked will no longer be autolinked to the same patient in the future by the
   * matching algorithm.
   *
   * @param urlToUnlinkPatients The URL to unlink the patients.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   */
  async unlinkPatients(
    urlToUnlinkPatients: string,
    options?: BaseOptions
  ): Promise<StatusResponse> {
    const headers = this.buildQueryHeaders(options?.meta);
    const resp = await this.executeWithRetriesOn500IfEnabled(() =>
      this.api.put(urlToUnlinkPatients, {}, { headers })
    );
    return statusResponseSchema.parse(resp.data);
  }

  /**
   * Edge Systems can perform a “reset” to a Patient which will detach all LOLA 2 links to the specified Patient. This
   * patient may be linked to the same collection of Patients (Person) again in the future.
   *
   * Use getPatientLinksByPatientId to get the ResetLink URL.
   *
   * @param urlToResetPatientLinks The URL to reset the patient links.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   */
  async resetPatientLinks(
    urlToResetPatientLinks: string,
    options?: BaseOptions
  ): Promise<StatusResponse> {
    const headers = this.buildQueryHeaders(options?.meta);
    const resp = await this.executeWithRetriesOn500IfEnabled(() =>
      this.api.put(urlToResetPatientLinks, {}, { headers })
    );
    return statusResponseSchema.parse(resp.data);
  }

  //--------------------------------------------------------------------------------------------
  // Document Management
  //--------------------------------------------------------------------------------------------

  private async queryDocumentsInternal(
    patientId: string,
    options?: BaseOptions & DocumentQueryParams
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const { meta, ...params } = options ?? {};
    const headers = this.buildQueryHeaders(meta);
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
    // console.log(`>>> Response RAW: ${JSON.stringify(response.data, null, 2)}`);
    return response.data;
  }

  /**
   * Queries a patient's Documents. Returns only documents.
   *
   * @param patientId The patient's ID.
   * @param options Query parameters and query parameters.
   * @param options.status The status of the document. Defaults to `current`, even if a param is
   *                      provided without status.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns an array of DocumentReference FHIR resources.
   */
  async queryDocuments(
    patientId: string,
    options?: BaseOptions & DocumentQueryParams
  ): Promise<DocumentReference[]> {
    const response = await this.queryDocumentsInternal(patientId, options);
    const entry = documentQueryResponseSchema.parse(response).entry;
    return entry?.flatMap(entry => entry.resource ?? []) ?? [];
  }

  /**
   * Queries a patient's Documents. Returns documents and errors from the fanout to other gateways.
   *
   * @param patientId The patient's ID.
   * @param options Query parameters and query parameters.
   * @param options.status The status of the document. Defaults to `current`, even if a param is
   *                      provided without status.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns a Bundle containing DocumentReferences of a patient's available DocumentReferences
   *          and/or OperationOutcomes denoting problems with the query.
   */
  async queryDocumentsFull(
    patientId: string,
    options?: BaseOptions & DocumentQueryParams
  ): Promise<DocumentQueryFullResponse> {
    const response = await this.queryDocumentsInternal(patientId, options);
    return documentQueryFullResponseSchema.parse(response);
  }

  /**
   * Retrieve a Document and send its bytes to the outputStream.
   *
   * @param inputUrl The URL of the file to be downloaded. Obtained from a DocumentReference that
   *                 was retrieved from a previous call to `queryDocuments`.
   * @param outputStream The stream to receive the downloaded file's bytes.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns The content type and size of the downloaded file.
   */
  async retrieveDocument(
    inputUrl: string,
    outputStream: stream.Writable,
    options?: BaseOptions
  ): Promise<RetrieveDocumentResponse> {
    const headers = this.buildQueryHeaders(options?.meta);
    const binary = await this.executeWithRetriesOn500IfEnabled(() =>
      downloadFileInMemory({
        url: inputUrl,
        client: this.api,
        responseType: "json",
        headers,
      })
    );
    const errorMessage = "Invalid binary contents";
    if (!("resourceType" in binary)) {
      throw new CommonwellError(errorMessage, undefined, { reason: "Missing resourceType" });
    }
    const resourceType = binary.resourceType;
    if (typeof resourceType !== "string" || resourceType !== "Binary") {
      throw new CommonwellError(errorMessage, undefined, { reason: "Invalid resourceType" });
    }
    const contentType = binary.contentType;
    if (!contentType || typeof contentType !== "string") {
      throw new CommonwellError(errorMessage, undefined, {
        reason: "Missing or invalid contentType",
        contentType,
      });
    }
    const data = binary.data;
    if (!data) throw new CommonwellError(errorMessage, undefined, { reason: "Missing data" });
    const dataBuffer = base64ToBuffer(data);
    outputStream.write(dataBuffer);
    outputStream.end();
    return { contentType, size: dataBuffer.byteLength };
  }

  //--------------------------------------------------------------------------------------------
  // Private methods
  //--------------------------------------------------------------------------------------------

  private buildQueryHeaders(
    metaParam: OrganizationRequestMetadata | undefined
  ): Record<string, string> {
    const meta = metaParam ?? this.buildOrganizationQueryMeta();
    const jwt = makeJwt({
      rsaPrivateKey: this.rsaPrivateKey,
      role: meta.role,
      subjectId: meta.subjectId,
      orgName: this.orgName,
      oid: this.oid,
      purposeOfUse: meta.purposeOfUse,
      npi: meta.npi,
      authGrantorReference: meta.authGrantorReference,
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

function buildProbableLinkEndpoint(orgId: string, patientId?: string) {
  return `${buildOrgEndpoint(orgId)}/ProbableLink${patientId ? `/${patientId}` : ""}`;
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

function normalizePatient(patient: Patient): Patient {
  return {
    ...patient,
    ...(patient.gender ? { gender: fhirGenderToCommonwell(patient.gender) } : {}),
    ...(patient.birthDate ? { birthDate: normalizeDatetime(patient.birthDate) } : {}),
  };
}
