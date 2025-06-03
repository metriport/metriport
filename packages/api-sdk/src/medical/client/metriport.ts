import { Bundle, DocumentReference as FHIRDocumentReference, Resource } from "@medplum/fhirtypes";
import { PaginatedResponse } from "@metriport/shared";
import {
  WebhookRequest,
  WebhookRequestParsingFailure,
  WebhookStatusResponse,
  webhookRequestSchema,
} from "@metriport/shared/medical";
import axios, { AxiosInstance, AxiosStatic, CreateAxiosDefaults } from "axios";
import crypto from "crypto";
import status from "http-status";
import {
  API_KEY_HEADER,
  BASE_ADDRESS,
  BASE_ADDRESS_SANDBOX,
  DEFAULT_AXIOS_TIMEOUT_MILLIS,
  JWT_HEADER,
  optionalDateToISOString,
} from "../../shared";
import { getETagHeader } from "../models/common/base-update";
import { Demographics } from "../models/demographics";
import {
  BulkGetDocumentUrlQuery,
  DocumentQuery,
  DocumentReference,
  ListDocumentFilters,
  ListDocumentResult,
  UploadDocumentResult,
  bulkGetDocumentUrlQuerySchema,
  documentListSchema,
  documentQuerySchema,
} from "../models/document";
import { Facility, FacilityCreate, facilityListSchema, facilitySchema } from "../models/facility";
import { ConsolidatedCountResponse, ResourceTypeForConsolidation } from "../models/fhir";
import { NetworkEntry } from "../models/network-entry";
import { Organization, OrganizationCreate, organizationSchema } from "../models/organization";
import {
  GetConsolidatedQueryProgressResponse,
  GetSingleConsolidatedQueryProgressResponse,
  MedicalRecordUrlResponse,
  PatientCreate,
  PatientHieOptOutResponse,
  PatientUpdate,
  StartConsolidatedQueryProgressResponse,
  medicalRecordUrlResponseSchema,
} from "../models/patient";
import { PatientDTO } from "../models/patientDTO";
import { SettingsResponse } from "../models/settings-response";

const NO_DATA_MESSAGE = "No data returned from API";
const BASE_PATH = "/medical/v1";
const ORGANIZATION_URL = `/organization`;
const FACILITY_URL = `/facility`;
const NETWORK_ENTRY_URL = `/network-entry`;
const PATIENT_URL = `/patient`;
const DOCUMENT_URL = `/document`;
const REQUEST_ID_HEADER_NAME = "x-metriport-request-id";

export type Options = {
  axios?: AxiosStatic; // Set axios if it fails to load
  timeout?: number;
  additionalHeaders?: Record<string, string>;
  mode?: "api-key" | "jwt";
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

/**
 * Pagination options. Either fromItem or toItem can be provided, but not both.
 * - fromItem: The ID of the first item to be returned.
 * - toItem: The ID of the last item to be returned.
 * - count: The number of items to be returned - defaults to 50, max is 500.
 */
export type Pagination = {
  fromItem?: string;
  toItem?: string;
  count?: number;
};

export class MetriportMedicalApi {
  // TODO this should be private
  readonly api: AxiosInstance;
  private _lastRequestId: string | undefined;

  private optionsForSettingsEndpoints = {
    baseURL: "/",
  };

  static readonly headers = {
    clientApp: "x-metriport-client",
  };

  /**
   * Creates a new instance of the Metriport Medical API client.
   *
   * @param apiKey Your Metriport API key.
   * @param options - Optional parameters
   * @param options.additionalHeaders - HTTP headers to be used in all requests.
   * @param options.axios - Axios instance, default, useful when the dependency is not being imported
   *          properly by NPM.
   * @param options.sandbox - Indicates whether to connect to the sandbox, default false.
   * @param options.timeout - Connection timeout in milliseconds, default 20 seconds.
   */
  constructor(apiKey: string, options: Options = {}) {
    const { sandbox, timeout } = options;

    const mode = options.mode || "api-key";
    const headers = {
      ...(mode === "api-key" ? { [API_KEY_HEADER]: apiKey } : { [JWT_HEADER]: "Bearer " + apiKey }),
      ...options.additionalHeaders,
    };

    const baseHostAndProtocol =
      options.baseAddress ?? (sandbox ? BASE_ADDRESS_SANDBOX : BASE_ADDRESS);
    const baseURL = baseHostAndProtocol + BASE_PATH;

    const axiosConfig: CreateAxiosDefaults = {
      timeout: timeout ?? DEFAULT_AXIOS_TIMEOUT_MILLIS,
      baseURL,
      headers,
    };
    this.optionsForSettingsEndpoints.baseURL = baseHostAndProtocol;

    if (axios) {
      this.api = axios.create(axiosConfig);
    } else if (options.axios) {
      this.api = options.axios.create(axiosConfig);
    } else {
      throw new Error(`Failed to initialize Axios`);
    }
  }

  /**
   * The ID from the last request made to the API.
   */
  get lastRequestId(): string | undefined {
    return this._lastRequestId;
  }

  /**
   * Gets the settings for your account.
   *
   * @returns Your account settings.
   */
  async getSettings(): Promise<SettingsResponse> {
    const resp = await this.api.get<SettingsResponse>("/settings", {
      ...this.optionsForSettingsEndpoints,
    });
    return resp.data;
  }

  /**
   * Update the settings for your account.
   *
   * @returns Your updated account settings.
   */
  async updateSettings(webhookUrl: string): Promise<SettingsResponse> {
    const resp = await this.api.post<SettingsResponse>(
      "/settings",
      { webhookUrl },
      { ...this.optionsForSettingsEndpoints }
    );
    return resp.data;
  }

  /**
   * Gets the status of communication with your app's webhook.
   *
   * @returns The status of communication with your app's webhook.
   */
  async getWebhookStatus(): Promise<WebhookStatusResponse> {
    const resp = await this.api.get<WebhookStatusResponse>("/settings/webhook", {
      ...this.optionsForSettingsEndpoints,
    });
    return resp.data;
  }

  /**
   * Retries failed webhook requests.
   *
   * @returns void
   */
  async retryWebhookRequests(): Promise<void> {
    await this.api.post("/settings/webhook/retry", undefined, {
      ...this.optionsForSettingsEndpoints,
    });
  }

  /**
   * Creates a new organization if one does not already exist.
   *
   * @param data The data to be used to create a new organization.
   * @throws Error (400) if an organization already exists for the customer.
   * @returns The created organization.
   */
  async createOrganization(data: OrganizationCreate): Promise<Organization> {
    const resp = await this.api.post(ORGANIZATION_URL, data);
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
    const resp = await this.api.put(`${ORGANIZATION_URL}/${organization.id}`, payload, {
      headers: { ...getETagHeader(organization) },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return organizationSchema.parse(resp.data);
  }

  /**
   * Retrieve an organization representing this account.
   *
   * @returns The organization, or undefined if no organization has been created.
   */
  async getOrganization(): Promise<Organization | undefined> {
    const resp = await this.api.get(ORGANIZATION_URL);
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
    const resp = await this.api.post(`${FACILITY_URL}`, data);
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
    const resp = await this.api.get(`${FACILITY_URL}/${id}`);
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
    const resp = await this.api.put(`${FACILITY_URL}/${facility.id}`, payload, {
      headers: { ...getETagHeader(facility) },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return facilitySchema.parse(resp.data);
  }

  /**
   * Returns the facilities associated with this account.
   *
   * @return The list of facilities.
   */
  async listFacilities(): Promise<Facility[]> {
    const resp = await this.api.get(`${FACILITY_URL}`);
    if (!resp.data) return [];
    return facilityListSchema.parse(resp.data).facilities;
  }

  /**
   * Deletes a facility. It will fail if the facility has patients associated with it.
   *
   * @param facilityId The ID of facility to be deleted.
   */
  async deleteFacility(facilityId: string, eTag?: string): Promise<void> {
    await this.api.delete(`${FACILITY_URL}/${facilityId}`, {
      headers: { ...getETagHeader({ eTag }) },
    });
  }

  /**
   * Returns the network entries supported by Metriport.
   *
   * @param filter Full text search filters, optional. If not provided, all network entries will be returned
   *                (according to pagination settings).
   *                See https://docs.metriport.com/medical-api/more-info/filters
   * @param pagination Pagination settings, optional. If not provided, we paginate with a default page size of 100 items, and the first page will be returned.
   *                   See https://docs.metriport.com/medical-api/more-info/pagination
   * @returns An object containing:
   * - `networkEntries` - The network entries in the current page.
   * - `meta` - Pagination information, including how to get to the next page.
   */
  async listNetworkEntries({
    filter,
    pagination,
  }: {
    filter?: string | undefined;
    pagination?: Pagination | undefined;
  } = {}): Promise<PaginatedResponse<NetworkEntry, "networkEntries">> {
    const resp = await this.api.get(`${NETWORK_ENTRY_URL}`, {
      params: {
        filter,
        ...getPaginationParams(pagination),
      },
    });
    if (!resp.data) return { meta: { itemsOnPage: 0 }, networkEntries: [] };
    return resp.data;
  }

  async listNetworkEntriesPage(
    url: string
  ): Promise<PaginatedResponse<NetworkEntry, "networkEntries">> {
    const resp = await this.api.get(url);
    return resp.data;
  }

  /**
   * Creates a new patient at Metriport and HIEs.
   *
   * @param data The data to be used to create a new patient.
   * @param facilityId The facility providing the NPI to support this operation.
   * @param additionalQueryParams Optional, additional query parameters to be sent with the request.
   * @return The newly created patient.
   */
  async createPatient(
    data: PatientCreate,
    facilityId: string,
    additionalQueryParams: Record<string, string | number | boolean> = {}
  ): Promise<PatientDTO> {
    const resp = await this.api.post(`${PATIENT_URL}`, data, {
      params: { facilityId, ...additionalQueryParams },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return resp.data as PatientDTO;
  }

  /**
   * Returns a patient.
   *
   * @param id The ID of the patient to be returned.
   * @return The patient.
   */
  async getPatient(id: string): Promise<PatientDTO> {
    const resp = await this.api.get(`${PATIENT_URL}/${id}`);
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return resp.data as PatientDTO;
  }

  /**
   * Returns a patient based on external ID.
   *
   * @param externalId The external ID of the patient to be returned.
   * @param source The source of the external ID, if required.
   * @return The patient.
   */
  async getPatientByExternalId(
    externalId: string,
    source?: string
  ): Promise<PatientDTO | undefined> {
    const resp = await this.api.get(`${PATIENT_URL}/external-id`, {
      params: { externalId, source },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return resp.data as PatientDTO;
  }

  /**
   * Searches for a patient previously created at Metriport, based on demographics.
   *
   * @return The patient if found.
   */
  async matchPatient(data: Demographics): Promise<PatientDTO | undefined> {
    try {
      const resp = await this.api.post(`${PATIENT_URL}/match`, data);
      if (!resp.data) throw new Error(NO_DATA_MESSAGE);
      return resp.data as PatientDTO;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.response?.status !== status.NOT_FOUND) throw err;
      return undefined;
    }
  }

  /**
   * Updates a patient at Metriport and at HIEs the patient is linked to.
   *
   * @param patient The patient data to be updated.
   * @param facilityId Optional. The facility providing the NPI to support this operation. If not provided and the patient has only one facility, that one will be used. If not provided and the patient has multiple facilities, an error will be thrown.
   * @param additionalQueryParams Optional, additional query parameters to be sent with the request.
   * @return The updated patient.
   */
  async updatePatient(
    patient: PatientUpdate,
    facilityId?: string,
    additionalQueryParams: Record<string, string | number | boolean> = {}
  ): Promise<PatientDTO> {
    type FieldsToOmit = "id";
    const payload: Omit<PatientUpdate, FieldsToOmit> & Record<FieldsToOmit, undefined> = {
      ...patient,
      id: undefined,
    };
    const resp = await this.api.put(`${PATIENT_URL}/${patient.id}`, payload, {
      params: { facilityId, ...additionalQueryParams },
      headers: { ...getETagHeader(patient) },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return resp.data as PatientDTO;
  }

  /**
   * Updates a patient's HIE opt-out status.
   *
   * @param patientId The ID of the patient whose opt-out status should be updated
   * @param hieOptOut Boolean indicating whether to opt the patient out (true) or in (false)
   * @returns The updated opt-out status
   */
  async updatePatientHieOptOut(
    patientId: string,
    hieOptOut: boolean
  ): Promise<PatientHieOptOutResponse> {
    const resp = await this.api.put(`${PATIENT_URL}/${patientId}/hie-opt-out`, undefined, {
      params: { hieOptOut },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return resp.data;
  }

  // TODO #870 remove this
  /** ---------------------------------------------------------------------------
   * Returns a patient's consolidated data.
   * @deprecated Use startConsolidatedQuery() and getConsolidatedQueryStatus() instead.
   *
   * Note if only patientId is provided the endpoint may take long to respond as its
   * fetching all the resources for the patient.
   *
   * @param patientId The ID of the patient whose data is to be returned.
   * @param resources Optional array of resources to be returned.
   * @param dateFrom Optional start date that resources will be filtered by (inclusive). Format is YYYY-MM-DD.
   * @param dateTo Optional end date that resources will be filtered by (inclusive). Format is YYYY-MM-DD.
   * @param fromDashboard Optional parameter to indicate that the request is coming from the dashboard.
   * @return Patient's consolidated data.
   */
  async getPatientConsolidated(
    patientId: string,
    resources?: string[],
    dateFrom?: string,
    dateTo?: string,
    fromDashboard?: boolean
  ): Promise<Bundle<Resource>> {
    const resp = await this.api.get(`${PATIENT_URL}/${patientId}/consolidated`, {
      params: { resources: resources && resources.join(","), dateFrom, dateTo, fromDashboard },
    });
    return resp.data;
  }

  /** ---------------------------------------------------------------------------
   * Start a query for the patient's consolidated data (FHIR resources).
   * The results are sent through Webhook (see https://docs.metriport.com/medical-api/more-info/webhooks).
   * Only one query per given patient can be executed at a time.
   *
   * @param patientId The ID of the patient whose data is to be returned.
   * @param resources Optional array of resources to be returned (defaults to all resource types).
   * @param dateFrom Optional start date that resources will be filtered by (inclusive). Format is YYYY-MM-DD.
   * @param dateTo Optional end date that resources will be filtered by (inclusive). Format is YYYY-MM-DD.
   * @param conversionType Optional to indicate how the medical record should be rendered - one of:
   *      "pdf", "html", or "json" (defaults to "json"). The Webhook payload
   *      will contain a signed URL to download the file, which is active for 3 minutes.
   * @param fromDashboard Optional parameter to indicate that the request is coming from the dashboard.
   * @param metadata Optional metadata to be sent along the webhook request as response of this query.
   * @return The consolidated data query status.
   */
  async startConsolidatedQuery(
    patientId: string,
    resources?: readonly ResourceTypeForConsolidation[],
    dateFrom?: string,
    dateTo?: string,
    conversionType = "json",
    fromDashboard?: boolean,
    metadata?: Record<string, string>
  ): Promise<StartConsolidatedQueryProgressResponse> {
    const whMetadata = { metadata: metadata };
    const resp = await this.api.post(`${PATIENT_URL}/${patientId}/consolidated/query`, whMetadata, {
      params: {
        resources: resources && resources.join(","),
        dateFrom,
        dateTo,
        fromDashboard,
        conversionType,
      },
    });
    return resp.data;
  }

  /** ---------------------------------------------------------------------------
   * Get the consolidated data query status for a given patient.
   * The results to the query are sent through Webhook (see
   * startConsolidatedQuery() and https://docs.metriport.com/medical-api/more-info/webhooks).
   *
   * @param patientId The ID of the patient whose data is to be returned.
   * @return The consolidated data query status.
   */
  async getConsolidatedQueryStatus(
    patientId: string
  ): Promise<GetConsolidatedQueryProgressResponse> {
    const resp = await this.api.get(`${PATIENT_URL}/${patientId}/consolidated/query`);
    return resp.data;
  }

  /** ---------------------------------------------------------------------------
   * Get the consolidated data query status for a given patient and requestId.
   * The results to the query are sent through Webhook (see
   * startConsolidatedQuery() and https://docs.metriport.com/medical-api/more-info/webhooks).
   *
   * @param patientId The ID of the patient whose data is to be returned.
   * @param requestId The ID of the request to get the status of.
   * @return The single consolidated data query status.
   */
  async getSingleConsolidatedQueryStatus(
    patientId: string,
    requestId: string
  ): Promise<GetSingleConsolidatedQueryProgressResponse> {
    const resp = await this.api.get(`${PATIENT_URL}/${patientId}/consolidated/query/${requestId}`);
    return resp.data;
  }

  /** ---------------------------------------------------------------------------
   * Add patient data as FHIR resources. Those can later be queried with startConsolidatedQuery(),
   * and will be made available to HIEs.
   *
   * Note: each call to this function is limited to 1Mb of data (and 50 resources when in sandbox).
   * You can make multiple calls to this function to add more data.
   *
   * @param patientId The ID of the patient to associate resources to.
   * @param payload The FHIR Bundle to create resources.
   * @return FHIR Bundle with operation outcome.
   */
  async createPatientConsolidated(patientId: string, payload: Bundle): Promise<Bundle<Resource>> {
    const resp = await this.api.put(`${PATIENT_URL}/${patientId}/consolidated`, payload);
    this._lastRequestId = resp.headers[REQUEST_ID_HEADER_NAME];
    return resp.data;
  }

  /** ---------------------------------------------------------------------------
   * Returns the amount of resources available for a given patient, per resource type.
   *
   * @param patientId The ID of the patient whose data is to be returned.
   * @param resources Optional array of resources to be considered.
   * @param dateFrom Optional start date that resources will be filtered by (inclusive). Format is YYYY-MM-DD.
   * @param dateTo Optional end date that resources will be filtered by (inclusive). Format is YYYY-MM-DD.
   * @return the amount of resources available per resource type for the given Patient.
   */
  async countPatientConsolidated(
    patientId: string,
    resources?: readonly ResourceTypeForConsolidation[],
    dateFrom?: string,
    dateTo?: string
  ): Promise<ConsolidatedCountResponse> {
    const resp = await this.api.get(`${PATIENT_URL}/${patientId}/consolidated/count`, {
      params: { resources: resources && resources.join(","), dateFrom, dateTo },
    });
    return resp.data;
  }

  /**
   * Returns the medical record summary for a given patient.
   *
   * @param patientId The ID of the patient whose medical record summary is to be returned.
   * @return The medical record summary for the given patient.
   */
  async getPatientMedicalRecord(
    patientId: string,
    conversionType: "html" | "pdf"
  ): Promise<MedicalRecordUrlResponse> {
    const resp = await this.api.get(`${PATIENT_URL}/${patientId}/medical-record`, {
      params: { conversionType },
    });
    return medicalRecordUrlResponseSchema.parse(resp.data);
  }

  /**
   * Removes a patient at Metriport and at HIEs the patient is linked to.
   *
   * @param patientId The ID of the patient to be deleted.
   * @param facilityId The facility providing the NPI to support this operation.
   */
  async deletePatient(patientId: string, facilityId: string, eTag?: string): Promise<void> {
    await this.api.delete(`${PATIENT_URL}/${patientId}`, {
      params: { facilityId },
      headers: { ...getETagHeader({ eTag }) },
    });
  }

  /**
   * Returns the patients associated with given facility.
   *
   * @param facilityId The ID of the facility, optional. If not provided, patients from all facilities
   *                   will be returned.
   * @param filters Full text search filters, optional. If not provided, all patients will be returned
   *                (according to pagination settings).
   *                See https://docs.metriport.com/medical-api/more-info/filters
   * @param pagination Pagination settings, optional. If not provided, the first page will be returned.
   *                   See https://docs.metriport.com/medical-api/more-info/pagination
   * @returns An object containing:
   * - `patients` - A single page containing the patients corresponding to the given facility.
   * - `meta` - Pagination information, including how to get to the next page.
   */
  async listPatients({
    facilityId,
    filters,
    pagination,
  }: {
    facilityId?: string | undefined;
    filters?: string | undefined;
    pagination?: Pagination | undefined;
  } = {}): Promise<PaginatedResponse<PatientDTO, "patients">> {
    const resp = await this.api.get(`${PATIENT_URL}`, {
      params: {
        facilityId,
        filters,
        ...getPaginationParams(pagination),
      },
    });
    if (!resp.data) return { meta: { itemsOnPage: 0 }, patients: [] };
    return resp.data;
  }

  async listPatientsPage(url: string): Promise<PaginatedResponse<PatientDTO, "patients">> {
    const resp = await this.api.get(url);
    return resp.data;
  }

  /**
   * Returns document references for the given patient across HIEs.
   *
   * @param patientId Patient ID for which to retrieve document metadata.
   * @param filters.dateFrom Optional start date that docs will be filtered by (inclusive).
   *    If the type is Date, its assumed UTC. If the type is string, its assumed to be ISO 8601 (Date only).
   * @param filters.dateTo Optional end date that docs will be filtered by (inclusive).
   *    If the type is Date, its assumed UTC. If the type is string, its assumed to be ISO 8601 (Date only).
   * @param filters.content Optional value to search on the document reference
   *    (partial match and case insentitive, minimum 3 chars).
   * @return The list of document references.
   */
  async listDocuments(
    patientId: string,
    { dateFrom, dateTo, content }: ListDocumentFilters = {}
  ): Promise<ListDocumentResult> {
    const parsedDateFrom = optionalDateToISOString(dateFrom);
    const parsedDateTo = optionalDateToISOString(dateTo);

    const resp = await this.api.get(`${DOCUMENT_URL}`, {
      params: {
        patientId,
        dateFrom: parsedDateFrom,
        dateTo: parsedDateTo,
        content,
      },
    });
    if (!resp.data) return { documents: [] };
    return resp.data;
  }

  /**
   * @deprecated Use listDocuments() instead.
   *
   * Returns document references for the given patient across HIEs, in the DTO format.
   *
   * @param patientId Patient ID for which to retrieve document metadata.
   * @param filters.dateFrom Optional start date that docs will be filtered by (inclusive).
   *    If the type is Date, its assumed UTC. If the type is string, its assumed to be ISO 8601 (Date only).
   * @param filters.dateTo Optional end date that docs will be filtered by (inclusive).
   *    If the type is Date, its assumed UTC. If the type is string, its assumed to be ISO 8601 (Date only).
   * @param filters.content Optional value to search on the document reference
   *    (partial match and case insentitive, minimum 3 chars).
   * @return The list of document references.
   */
  async listDocumentsAsDTO(
    patientId: string,
    { dateFrom, dateTo, content }: ListDocumentFilters = {}
  ): Promise<DocumentReference[]> {
    const parsedDateFrom = optionalDateToISOString(dateFrom);
    const parsedDateTo = optionalDateToISOString(dateTo);

    const resp = await this.api.get(`${DOCUMENT_URL}`, {
      params: {
        patientId,
        dateFrom: parsedDateFrom,
        dateTo: parsedDateTo,
        content,
        output: "dto",
      },
    });
    if (!resp.data) return [];
    return documentListSchema.parse(resp.data).documents;
  }

  /**
   * Start a document query for the given patient across HIEs.
   *
   * @param patientId Patient ID for which to retrieve document metadata.
   * @param facilityId The facility providing the NPI to support this operation (optional).
   *        If not provided and the patient has only one facility, that one will be used.
   *        If not provided and the patient has multiple facilities, an error will be thrown.
   * @param metadata Optional metadata to be sent along the webhook request as response of this query.
   * @return The document query request ID, progress & status indicating whether its being executed or not.
   */
  async startDocumentQuery(
    patientId: string,
    facilityId?: string,
    metadata?: Record<string, string>
  ): Promise<DocumentQuery> {
    const whMetadata = { metadata: metadata };
    const resp = await this.api.post(`${DOCUMENT_URL}/query`, whMetadata, {
      params: {
        patientId,
        facilityId,
      },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return documentQuerySchema.parse(resp.data);
  }

  /**
   * Start a bulk document download for a given patient, with the payload returned to the webhook.
   *
   * @param patientId Patient ID for which to retrieve document URLs.
   * @param metadata Optional metadata to be sent along the webhook request as response of this query.
   * @return The document query request ID, progress, and status indicating whether it's being executed or not.
   */
  async startBulkGetDocumentUrl(
    patientId: string,
    metadata?: Record<string, string>
  ): Promise<BulkGetDocumentUrlQuery> {
    const whMetadata = { metadata: metadata };
    const resp = await this.api.post(`${DOCUMENT_URL}/download-url/bulk`, whMetadata, {
      params: {
        patientId,
      },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return bulkGetDocumentUrlQuerySchema.parse(resp.data);
  }

  /**
   * Returns the document query status for the specified patient.
   *
   * @param patientId Patient ID for which to retrieve document query status.
   * @return The document query request ID, progress & status indicating whether its being executed or not.
   */
  async getDocumentQueryStatus(patientId: string): Promise<DocumentQuery> {
    const resp = await this.api.get(`${DOCUMENT_URL}/query`, {
      params: { patientId },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return documentQuerySchema.parse(resp.data);
  }

  /**
   * Returns a URL that can be used to download the document.
   *
   * @param req.query.fileName The file name of the document in s3.
   * @param req.query.conversionType The doc type to convert to. Valid values are "html" and "pdf".
   * @return presigned url
   */
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getDocumentUrl(
    fileName: string,
    conversionType?: "html" | "pdf"
  ): Promise<{ url: string }> {
    const resp = await this.api.get(`${DOCUMENT_URL}/download-url`, {
      params: {
        fileName,
        conversionType,
      },
    });

    return resp.data;
  }

  /**
   * @deprecated - Use createDocumentReference() instead.
   * Returns a URL to upload a file to Metriport and make the document available to other HIEs.
   * To upload your file contents, execute a PUT request using this URL with the file contents as the request body.
   * Refer to Metriport documentation for more details:
   * https://docs.metriport.com/medical-api/api-reference/document/post-upload-url
   *
   * @param patientId - the ID of the patient.
   * @param docRef - a FHIR Document Reference for this file upload. Mandatory fields include DocumentReference.description, DocumentReference.type, and DocumentReference.context. Besides that, try to include as much metadata on the document as possible. Note that you DO NOT need to fill in the Organization or Patient fields under the author or contained fields - Metriport will fill this in and overwrite whatever you put in.
   * Refer to Metriport's documentation for more details: https://docs.metriport.com/medical-api/fhir/resources/documentreference.
   *
   * @returns A URL string to be used for subsequent file upload.
   */
  async getDocumentUploadUrl(
    patientId: string,
    docRef: Partial<FHIRDocumentReference>
  ): Promise<string> {
    const url = `${DOCUMENT_URL}/upload-url/?patientId=${patientId}`;
    const resp = await this.api.post(url, docRef);
    return resp.data;
  }

  /**
   * Creates a DocumentReference and returns its ID along with a URL to upload the respective Document file to Metriport and make this document available to other HIEs.
   * To upload your file contents, execute a PUT request using the returned uploadUrl with the file contents as the request body.
   * Refer to Metriport Documentation for more details:
   * https://docs.metriport.com/medical-api/api-reference/document/post-upload-url
   *
   * @param patientId - the ID of the patient.
   * @param docRef - a FHIR Document Reference for this file upload. Mandatory fields include DocumentReference.description, DocumentReference.type, and DocumentReference.context. Besides that, try to include as much metadata on the document as possible. Note that you DO NOT need to fill in the Organization or Patient fields under the author or contained fields - Metriport will fill this in and overwrite whatever you put in.
   * Refer to Metriport's documentation for more details: https://docs.metriport.com/medical-api/fhir/resources/documentreference.
   *
   * @returns The DocumentReference ID, and the URL to be used for subsequent file upload.
   */
  async createDocumentReference(
    patientId: string,
    docRef: Partial<FHIRDocumentReference>
  ): Promise<UploadDocumentResult> {
    const url = `${DOCUMENT_URL}/upload/?patientId=${patientId}`;
    const resp = await this.api.post(url, docRef);
    return resp.data;
  }

  /**
   * Verifies the signature of a webhook request.
   * Refer to Metriport's documentation for more details: https://docs.metriport.com/medical-api/more-info/webhooks.
   *
   * @param key - your webhook key.
   * @param body - the raw body of the webhook request, as string or Buffer.
   * @param signature - the signature obtained from the webhook request header.
   * @returns True if the signature is verified, false otherwise.
   * @throws Error if the body is not a string.
   */
  verifyWebhookSignature(key: string, body: string | Buffer, signature: string): boolean {
    return MetriportMedicalApi.verifyWebhookSignature(key, body, signature);
  }

  /**
   * Verifies the signature of a webhook request.
   * Refer to Metriport's documentation for more details: https://docs.metriport.com/medical-api/more-info/webhooks.
   *
   * @param key - your webhook key.
   * @param body - the raw body of the webhook request, as string or Buffer.
   * @param signature - the signature obtained from the webhook request header.
   * @returns True if the signature is verified, false otherwise.
   * @throws Error if the body is not a string.
   */
  static verifyWebhookSignature(key: string, body: string | Buffer, signature: string): boolean {
    if (typeof body !== "string" && !(body instanceof Buffer)) {
      throw new Error("Body must be a string or Buffer");
    }
    const normalizedBody = typeof body === "string" ? body : body.toString();
    const receivedSignature = signature;
    const expectedSignature = crypto.createHmac("sha256", key).update(normalizedBody).digest("hex");
    const a = Buffer.from(expectedSignature);
    const b = Buffer.from(receivedSignature);
    if (Buffer.byteLength(a) != Buffer.byteLength(b)) return false;
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Parses a webhook request received from the Metriport API and return an object of type
   * 'WebhookRequest'.
   * Note: currently, the type of the 'bundle' property is 'any', but it can be safely casted to
   * FHIR's 'Bundle<Resource> | undefined'.
   *
   * @param requestBody The request body received from the Metriport API.
   * @param throwOnError Whether to throw an Error if the request body is not a valid webhook request.
   *        Optional, defaults to true.
   * @returns The webhook request - instance of WebhookRequest, or an instance of
   *          WebhookRequestParsingError if the payload is invalid and throwOnError is 'false'.
   * @throws Error if the request body is not a valid webhook request and throwOnError is 'true'.
   *         Details can be obtained from the error object under the 'cause' property (instance
   *         of ZodError).
   */
  static parseWebhookResponse(
    requestBody: unknown,
    throwOnError: false
  ): WebhookRequest | WebhookRequestParsingFailure;
  static parseWebhookResponse(reqBody: unknown, throwOnError: true): WebhookRequest;
  static parseWebhookResponse(reqBody: unknown): WebhookRequest;
  static parseWebhookResponse(
    reqBody: unknown,
    throwOnError = true
  ): WebhookRequest | WebhookRequestParsingFailure {
    if (throwOnError) {
      try {
        return webhookRequestSchema.parse(reqBody);
      } catch (error) {
        throw new Error(`Failed to parse webhook request`, { cause: error });
      }
    }
    const parse = webhookRequestSchema.safeParse(reqBody);
    if (parse.success) return parse.data;
    return new WebhookRequestParsingFailure(parse.error, parse.error.format());
  }
}

function getPaginationParams(pagination?: Pagination) {
  const { fromItem, toItem, count } = pagination ?? {};
  return { fromItem, toItem, count };
}
