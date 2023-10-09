import { Bundle, Resource } from "@medplum/fhirtypes";
import axios, { AxiosInstance, AxiosStatic, CreateAxiosDefaults } from "axios";
import {
  API_KEY_HEADER,
  BASE_ADDRESS,
  BASE_ADDRESS_SANDBOX,
  DEFAULT_AXIOS_TIMEOUT_MILLIS,
  optionalDateToISOString,
} from "../../shared";
import { getETagHeader } from "../models/common/base-update";
import {
  documentListSchema,
  DocumentQuery,
  documentQuerySchema,
  DocumentReference,
  ListDocumentFilters,
  ListDocumentResult,
} from "../models/document";
import { Facility, FacilityCreate, facilityListSchema, facilitySchema } from "../models/facility";
import { ConsolidatedCountResponse, ResourceTypeForConsolidation } from "../models/fhir";
import { Organization, OrganizationCreate, organizationSchema } from "../models/organization";
import {
  Patient,
  PatientCreate,
  patientSchema,
  PatientUpdate,
  QueryStatus,
} from "../models/patient";

import { PatientDTO } from "../models/patientDTO";

const NO_DATA_MESSAGE = "No data returned from API";
const BASE_PATH = "/medical/v1";
const ORGANIZATION_URL = `/organization`;
const FACILITY_URL = `/facility`;
const PATIENT_URL = `/patient`;
const DOCUMENT_URL = `/document`;

export type Options = {
  axios?: AxiosStatic; // Set axios if it fails to load
  timeout?: number;
  additionalHeaders?: Record<string, string>;
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
    const headers = { [API_KEY_HEADER]: apiKey, ...options.additionalHeaders };
    const { sandbox, timeout } = options;

    const baseURL =
      (options.baseAddress || (sandbox ? BASE_ADDRESS_SANDBOX : BASE_ADDRESS)) + BASE_PATH;
    const axiosConfig: CreateAxiosDefaults = {
      timeout: timeout ?? DEFAULT_AXIOS_TIMEOUT_MILLIS,
      baseURL,
      headers,
    };

    if (axios) {
      this.api = axios.create(axiosConfig);
    } else if (options.axios) {
      this.api = options.axios.create(axiosConfig);
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
  async createPatient(data: PatientCreate, facilityId: string): Promise<PatientDTO> {
    const resp = await this.api.post(`${PATIENT_URL}`, data, {
      params: { facilityId },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return resp.data as PatientDTO;
  }

  /**
   * Returns a patient.
   *
   * @param id The ID of the patient to be returned.
   * @return The patients.
   */
  async getPatient(id: string): Promise<PatientDTO> {
    const resp = await this.api.get(`${PATIENT_URL}/${id}`);
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return resp.data as PatientDTO;
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
    const resp = await this.api.put(`${PATIENT_URL}/${patient.id}`, payload, {
      params: { facilityId },
      headers: { ...getETagHeader(patient) },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return patientSchema.parse(resp.data);
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
   * @return Patient's consolidated data.
   */
  async getPatientConsolidated(
    patientId: string,
    resources?: string[],
    dateFrom?: string,
    dateTo?: string
  ): Promise<Bundle<Resource>> {
    const resp = await this.api.get(`${PATIENT_URL}/${patientId}/consolidated`, {
      params: { resources: resources && resources.join(","), dateFrom, dateTo },
    });
    return resp.data;
  }

  /** ---------------------------------------------------------------------------
   * Start a query for the patient's consolidated data (FHIR resources).
   * The results are sent through Webhook (see https://docs.metriport.com/medical-api/more-info/webhooks).
   * Only one query per given patient can be executed at a time.
   *
   * @param patientId The ID of the patient whose data is to be returned.
   * @param resources Optional array of resources to be returned.
   * @param dateFrom Optional start date that resources will be filtered by (inclusive). Format is YYYY-MM-DD.
   * @param dateTo Optional end date that resources will be filtered by (inclusive). Format is YYYY-MM-DD.
   * @return The consolidated data query status.
   */
  async startConsolidatedQuery(
    patientId: string,
    resources?: readonly ResourceTypeForConsolidation[],
    dateFrom?: string,
    dateTo?: string
  ): Promise<QueryStatus> {
    const resp = await this.api.post(`${PATIENT_URL}/${patientId}/consolidated/query`, undefined, {
      params: { resources: resources && resources.join(","), dateFrom, dateTo },
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
  async getConsolidatedQueryStatus(patientId: string): Promise<QueryStatus> {
    const resp = await this.api.get(`${PATIENT_URL}/${patientId}/consolidated/query`);
    return resp.data;
  }

  /** ---------------------------------------------------------------------------
   * Add patient data as FHIR resources. Those can later be queried with startConsolidatedQuery(),
   * and will be made available to HIEs.
   *
   * Note: each call to this function is limited to 50 resources and 1Mb of data. You can make multiple
   * calls to this function to add more data.
   *
   * @param patientId The ID of the patient to associate resources to.
   * @param payload The FHIR Bundle to create resources.
   * @return FHIR Bundle with operation outcome.
   */
  async createPatientConsolidated(patientId: string, payload: Bundle): Promise<Bundle<Resource>> {
    const resp = await this.api.put(`${PATIENT_URL}/${patientId}/consolidated`, payload);

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
   * Removes a patient at Metriport and at HIEs the patient is linked to.
   *
   * @param patientId The ID of the patient data to be deleted.
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
   * @param facilityId The ID of the facility.
   * @return The list of patients.
   */
  async listPatients(facilityId: string): Promise<PatientDTO[]> {
    const resp = await this.api.get(`${PATIENT_URL}`, {
      params: { facilityId },
    });
    if (!resp.data) return [];
    return resp.data.patients as PatientDTO[];
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
   * @param facilityId The facility providing the NPI to support this operation.
   * @return The document query request ID, progress & status indicating whether its being executed or not.
   */
  async startDocumentQuery(patientId: string, facilityId: string): Promise<DocumentQuery> {
    const resp = await this.api.post(`${DOCUMENT_URL}/query`, null, {
      params: {
        patientId,
        facilityId,
      },
    });
    if (!resp.data) throw new Error(NO_DATA_MESSAGE);
    return documentQuerySchema.parse(resp.data);
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
    const resp = await this.api.get(`${DOCUMENT_URL}/downloadUrl`, {
      params: {
        fileName,
        conversionType,
      },
    });

    return resp.data;
  }
}
