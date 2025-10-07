import { BadRequestError, base64ToBuffer, MetriportError, NotFoundError } from "@metriport/shared";
import { isAxiosError } from "axios";
import httpStatus from "http-status";
import * as stream from "stream";
import { CommonwellError } from "../common/commonwell-error";
import { downloadFileInMemory } from "../common/fileDownload";
import { makeJwt } from "../common/make-jwt";
import {
  buildBaseQueryMeta,
  encodeCwPatientId,
  encodePatientIdForDocumentExchange,
} from "../common/util";
import { normalizeDatetime } from "../models/date";
import { GenderCodes } from "../models/demographics";
import {
  DocumentQueryFullResponse,
  documentQueryFullResponseSchema,
  documentQueryResponseSchema,
  DocumentReference,
} from "../models/document";
import {
  Patient,
  PatientCreateOrUpdateResp,
  PatientExistingLinks,
  patientExistingLinksSchema,
  PatientProbableLinks,
  patientProbableLinksRespSchema,
  PatientResponseItem,
  patientResponseSchema,
  StatusResponse,
  statusResponseSchema,
} from "../models/patient";
import { APIMode, CommonWellOptions } from "./common";
import {
  BaseOptions,
  CommonWellAPI,
  DocumentQueryParams,
  GetPatientParams,
  OrganizationRequestMetadata,
  RetrieveDocumentResponse,
} from "./commonwell-api";
import { CommonWellBase } from "./commonwell-base";

/**
 * Implementation of the CommonWell API, v4.
 * @see https://www.commonwellalliance.org/specification/
 */
export class CommonWell extends CommonWellBase implements CommonWellAPI {
  private _orgName: string;
  private _oid: string;
  private _npi: string;
  private _homeCommunityId: string;
  private _authGrantorReferenceOid?: string | undefined;

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
    authGrantorReferenceOid: authGrantorReference,
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
    /** The OID of the principal organization who authorized the request, aka The Principal. */
    authGrantorReferenceOid?: string | undefined;
    /** Optional parameters. */
    options?: CommonWellOptions;
  }) {
    super({
      orgCert,
      rsaPrivateKey,
      apiMode,
      options,
    });
    this._orgName = orgName;
    this._oid = oid;
    this._npi = npi;
    this._homeCommunityId = homeCommunityId;
    this._authGrantorReferenceOid = authGrantorReference;
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
  async createOrUpdatePatient(
    patient: Patient,
    options?: BaseOptions
  ): Promise<PatientCreateOrUpdateResp> {
    const headers = this.buildQueryHeaders(options?.meta);
    const url = buildPatientEndpoint(this.oid);
    const normalizedPatient = normalizePatient(patient);

    const resp = await this.executeWithRetriesOn500IfEnabled(() =>
      this.api.post(url, normalizedPatient, { headers })
    );
    const parsed = patientResponseSchema.parse(resp.data);
    const links = parsed.Patients[0].Links;
    return {
      Links: links,
      status: parsed.status ?? undefined,
    };
  }

  /**
   * Returns a patient based on its ID.
   *
   * @param params The patient ID and optional assign authority and assign authority type.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns The patient response item containing the patient in the first position.
   * @throws MetriportError if multiple patients are found for the given ID.
   */
  async getPatient(
    params: GetPatientParams,
    options?: BaseOptions
  ): Promise<PatientResponseItem | undefined>;
  /**
   * Returns a patient based on its ID. From the spec, about the patient ID:
   *
   * The local Patient Identifier. The value is under the control of the local Edge System and
   * represents the unique identifier for the Patient Record in the local system. The format
   * for this identifier MUST follow the HL7 CX data type format:
   *
   * IdentifierValue^^^&PatientIdAssignAuthority&PatientIdAssignAuthorityType
   *
   * @param id      Patient's ID, HL7 CX data type format.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns The patient response item containing the patient in the first position.
   * @throws MetriportError if multiple patients are found for the given ID.
   * @see Section "8.3.2 Get Patient" of the spec.
   */
  async getPatient(id: string, options?: BaseOptions): Promise<PatientResponseItem>;
  async getPatient(
    idOrParams: string | GetPatientParams,
    options?: BaseOptions
  ): Promise<PatientResponseItem> {
    let patientId: string;
    if (typeof idOrParams !== "string") {
      patientId = idOrParams.id;
      const { assignAuthority, assignAuthorityType } = idOrParams;
      patientId = encodeCwPatientId({
        patientId,
        assignAuthority,
        assignAuthorityType,
      });
    } else {
      if (!idOrParams) {
        throw new Error("Programming error: 'id' is required when providing separate parameters");
      }
      patientId = idOrParams;
    }
    const headers = this.buildQueryHeaders(options?.meta);
    const url = buildPatientEndpoint(this.oid, patientId);
    const resp = await this.executeWithRetriesOn500IfEnabled(() => this.api.get(url, { headers }));
    const parsed = patientResponseSchema.parse(resp.data);
    if (parsed.Patients.length > 1) {
      throw new MetriportError("Multiple patients found for the given ID", undefined, {
        patientId,
        count: parsed.Patients.length,
      });
    }
    return parsed.Patients[0];
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
   * @param patientId           The person id to be link to a patient.
   * @returns Response with list of links to Patients
   */
  async getPatientLinksByPatientId(
    patientId: string,
    options?: BaseOptions
  ): Promise<PatientExistingLinks> {
    const headers = this.buildQueryHeaders(options?.meta);
    const url = buildPatientLinkEndpoint(this.oid, patientId);
    try {
      const resp = await this.executeWithRetriesOn500IfEnabled(() =>
        this.api.get(url, { headers })
      );
      return patientExistingLinksSchema.parse(resp.data);
    } catch (error) {
      throw this.getDescriptiveError(error, "Failed to get patient links by patient id");
    }
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
  ): Promise<PatientProbableLinks> {
    const headers = this.buildQueryHeaders(options?.meta);
    const url = buildProbableLinkEndpoint(this.oid, patientId);

    try {
      const resp = await this.executeWithRetriesOn500IfEnabled(() =>
        this.api.get(url, { headers })
      );
      return patientProbableLinksRespSchema.parse(resp.data);
    } catch (error) {
      throw this.getDescriptiveError(error, "Failed to get probable links by patient id");
    }
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
      gender: GenderCodes;
      zip: string;
    },
    options?: BaseOptions
  ): Promise<PatientProbableLinks> {
    const headers = this.buildQueryHeaders(options?.meta);
    const params = new URLSearchParams();
    params.append("fname", firstName);
    params.append("lname", lastName);
    params.append("dob", dob);
    params.append("gender", gender);
    params.append("zip", zip);
    const url = buildProbableLinkEndpoint(this.oid);
    const resp = await this.executeWithRetriesOn500IfEnabled(() =>
      this.api.get(url + `?${params.toString()}`, { headers })
    );
    return patientProbableLinksRespSchema.parse(resp.data);
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
    const subjectId = encodePatientIdForDocumentExchange(patientId);
    if (!subjectId) {
      throw new CommonwellError(`Could not determine subject ID for document query`, undefined, {
        patientId,
      });
    }
    const url = buildDocumentQueryUrl(subjectId, actualParams);
    const response = await this.executeWithRetriesOn500IfEnabled(() =>
      this.api.get(url, { headers })
    );
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

    try {
      const binary = await this.executeWithRetriesOn500IfEnabled(() =>
        downloadFileInMemory({
          url: inputUrl,
          client: this.api,
          responseType: "json",
          headers,
        })
      );

      if (typeof binary === "string") {
        try {
          const dataBuffer = base64ToBuffer(binary);
          outputStream.write(dataBuffer);
          outputStream.end();
          return { contentType: "application/xml", size: dataBuffer.byteLength };
        } catch (error) {
          // Continue with the flow...
        }
      }

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
      if (!data)
        throw new CommonwellError(errorMessage, undefined, {
          reason: "Missing data",
          contentType,
          resourceType,
          properties:
            typeof binary === "object" && binary != null
              ? Object.keys(binary).join(", ")
              : "not-an-object",
          inputUrl,
        });
      const dataBuffer = base64ToBuffer(data);
      outputStream.write(dataBuffer);
      outputStream.end();
      return { contentType, size: dataBuffer.byteLength };
    } catch (error) {
      throw this.getDescriptiveError(error, "Failed to download document");
    }
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
    return {
      ...base,
      npi: this.npi,
      ...(this._authGrantorReferenceOid
        ? { authGrantorReference: this._authGrantorReferenceOid }
        : {}),
    };
  }

  private getDescriptiveError(error: unknown, title: string): unknown {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      const responseBody = data ? JSON.stringify(data) : undefined;
      const cwReference = this.lastTransactionId;

      if (status === httpStatus.BAD_REQUEST) {
        return new BadRequestError(title, error, { status, cwReference, responseBody });
      }
      if (status === httpStatus.NOT_FOUND) {
        return new NotFoundError(title, error, { status, cwReference, responseBody });
      }
      return new MetriportError(title, error, { status, cwReference, responseBody });
    }
    return error;
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

function buildDocumentQueryUrl(patientId: string, params: DocumentQueryParams): string {
  const urlParams = new URLSearchParams();
  urlParams.append("patient.identifier", patientId);
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
    ...(patient.birthDate ? { birthDate: normalizeDatetime(patient.birthDate) } : {}),
  };
}
