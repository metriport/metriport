import {
  AllergyIntolerance,
  Appointment as AppointmentFhir,
  Bundle,
  Condition,
  Encounter,
  Location,
  Medication,
  MedicationStatement,
  Patient as PatientFhir,
  Practitioner,
} from "@medplum/fhirtypes";
import {
  BadRequestError,
  errorToString,
  JwtTokenInfo,
  MetriportError,
  NotFoundError,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  Appointment,
  AppointmentListResponse,
  appointmentListResponseSchema,
  canvasClientJwtTokenResponseSchema,
  SlimBookedAppointment,
  slimBookedAppointmentSchema,
} from "@metriport/shared/interface/external/ehr/canvas/index";
import {
  FhirResource,
  FhirResourceBundle,
  fhirResourceBundleSchema,
  FhirResources,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { Patient, patientSchema } from "@metriport/shared/interface/external/ehr/patient";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import { RXNORM_URL as RXNORM_SYSTEM } from "../../../util/constants";
import { out } from "../../../util/log";
import {
  ApiConfig,
  formatDate,
  getSavedResponseFromS3,
  GetSavedResponseFromS3ParamsInEhr,
  makeRequest,
  MakeRequestParamsInEhr,
} from "../shared";

interface CanvasApiConfig extends ApiConfig {
  environment: string;
}

const canvasDomainExtension = ".canvasmedical.com";
const canvasDateFormat = "YYYY-MM-DD";
export type CanvasEnv = string;

export const supportedCanvasDiffResources = [
  "AllergyIntolerance",
  "Condition",
  "DiagnosticReport",
  "Encounter",
  "Medication",
  "MedicationStatement",
  "MedicationRequest",
  "Observation",
  "Procedure",
];
export type SupportedCanvasDiffResource = (typeof supportedCanvasDiffResources)[number];
export const isSupportedCanvasDiffResource = (
  resourceType: string
): resourceType is SupportedCanvasDiffResource => {
  return supportedCanvasDiffResources.includes(resourceType as SupportedCanvasDiffResource);
};

type MakeRequestParams<T> = MakeRequestParamsInEhr<T> & { useFhir?: boolean };

class CanvasApi {
  private axiosInstanceFhirApi: AxiosInstance;
  private axiosInstanceCustomApi: AxiosInstance;
  private twoLeggedAuthTokenInfo: JwtTokenInfo | undefined;
  private baseUrl: string;
  private practiceId: string;

  private constructor(private config: CanvasApiConfig) {
    this.twoLeggedAuthTokenInfo = config.twoLeggedAuthTokenInfo;
    this.practiceId = config.practiceId;
    this.axiosInstanceFhirApi = axios.create({});
    this.axiosInstanceCustomApi = axios.create({});
    this.baseUrl = `${config.environment}${canvasDomainExtension}`;
  }

  public static async create(config: CanvasApiConfig): Promise<CanvasApi> {
    const instance = new CanvasApi(config);
    await instance.initialize();
    return instance;
  }

  getTwoLeggedAuthTokenInfo(): JwtTokenInfo | undefined {
    return this.twoLeggedAuthTokenInfo;
  }

  private async fetchTwoLeggedAuthToken(): Promise<JwtTokenInfo> {
    const url = `https://${this.baseUrl}/auth/token/`;
    const payload = `grant_type=client_credentials&client_id=${this.config.clientKey}&client_secret=${this.config.clientSecret}`;

    try {
      const response = await axios.post(url, payload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (!response.data) throw new MetriportError("No body returned from token endpoint");
      const tokenData = canvasClientJwtTokenResponseSchema.parse(response.data);
      return {
        access_token: tokenData.access_token,
        exp: new Date(Date.now() + +tokenData.expires_in * 1000),
      };
    } catch (error) {
      throw new MetriportError("Failed to fetch OAuth token @ Canvas", undefined, {
        error: errorToString(error),
      });
    }
  }

  async initialize(): Promise<void> {
    const { log } = out(`Canvas initialize - practiceId ${this.practiceId}`);
    if (!this.twoLeggedAuthTokenInfo) {
      log(`Two Legged Auth token not found @ Canvas - fetching new token`);
      this.twoLeggedAuthTokenInfo = await this.fetchTwoLeggedAuthToken();
    } else if (this.twoLeggedAuthTokenInfo.exp < buildDayjs().add(15, "minutes").toDate()) {
      log(`Two Legged Auth token expired @ Canvas - fetching new token`);
      this.twoLeggedAuthTokenInfo = await this.fetchTwoLeggedAuthToken();
    } else {
      log(`Two Legged Auth token found @ Canvas - using existing token`);
    }

    this.axiosInstanceFhirApi = axios.create({
      baseURL: `https://fumage-${this.baseUrl}`,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.twoLeggedAuthTokenInfo.access_token}`,
        "Content-Type": "application/json",
      },
    });

    this.axiosInstanceCustomApi = axios.create({
      baseURL: `https://${this.baseUrl}/core/api`,
      headers: {
        Authorization: `Bearer ${this.twoLeggedAuthTokenInfo.access_token}`,
        "Content-Type": "application/json",
      },
    });
  }

  private async handleAxiosRequest<T>(
    requestFunction: () => Promise<AxiosResponse<T>>
  ): Promise<AxiosResponse<T>> {
    try {
      const response = await requestFunction();
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status;
        const errorMessage = axiosError.response?.data;
        const msg = `Request failed. Status: ${statusCode}. Message: ${JSON.stringify(
          errorMessage
        )}`;
        console.log("error", JSON.stringify(error, null, 2));
        throw new Error(msg);
      }
      throw new Error("An unexpected error occurred during the request");
    }
  }

  async getPractitioner(name: string): Promise<Practitioner> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.get(
        `Practitioner?name=${name}&include-non-scheduleable-practitioners=true`
      )
    );
    return response.data.entry[0].resource;
  }

  async createPatient(patient: PatientFhir): Promise<string> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.post("Patient", patient)
    );

    const locationHeader = response.headers["location"];
    const patientId = locationHeader?.split("/").pop() ?? "";
    return patientId;
  }

  async getLocation(): Promise<Location> {
    const response = await this.handleAxiosRequest(() => this.axiosInstanceFhirApi.get(`Location`));
    return response.data.entry[0].resource;
  }

  async createNote({
    patientKey,
    providerKey,
    practiceLocationKey,
    noteTypeName,
  }: {
    patientKey: string;
    providerKey: string;
    practiceLocationKey: string;
    noteTypeName: string;
  }) {
    const payload = {
      title: "Metriport Chart Import",
      noteTypeName,
      patientKey,
      providerKey,
      practiceLocationKey,
      encounterStartTime: new Date().toISOString(),
    };

    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceCustomApi.post("notes/v1/Note", payload)
    );
    return response.data.noteKey;
  }

  async updateNoteTitle({ noteKey, title }: { noteKey: string; title: string }): Promise<void> {
    const payload = {
      title,
    };

    await this.handleAxiosRequest(() =>
      this.axiosInstanceCustomApi.patch(`notes/v1/Note/${noteKey}`, payload)
    );
  }

  async createCondition({
    condition,
    patientId,
    practitionerId,
    noteId,
  }: {
    condition: Condition;
    patientId: string;
    practitionerId: string;
    noteId: string;
  }): Promise<string> {
    condition.subject = { reference: `Patient/${patientId}` };
    condition.recorder = { reference: `Practitioner/${practitionerId}` };
    condition.extension = [
      {
        url: "http://schemas.canvasmedical.com/fhir/extensions/note-id",
        valueId: noteId,
      },
    ];
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.post("Condition", condition)
    );
    return response.headers["location"]?.split("/").pop() ?? "";
  }

  async createMedicationStatement({
    medication,
    patientId,
    noteId,
  }: {
    medication: MedicationStatement;
    patientId: string;
    noteId: string;
  }): Promise<string> {
    medication.subject = { reference: `Patient/${patientId}` };
    medication.extension = [
      {
        url: "http://schemas.canvasmedical.com/fhir/extensions/note-id",
        valueId: noteId,
      },
    ];
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.post("MedicationStatement", medication)
    );
    return response.headers["location"]?.split("/").pop() ?? "";
  }

  async createAllergy({
    allergy,
    patientId,
    noteId,
    practitionerId,
  }: {
    allergy: AllergyIntolerance;
    patientId: string;
    noteId: string;
    practitionerId: string;
  }): Promise<string> {
    if (!patientId || !noteId || !practitionerId) {
      throw new Error(
        "Patient ID, Note ID, and Practitioner ID must be set before adding an allergy"
      );
    }
    allergy.patient = { reference: `Patient/${patientId}` };
    allergy.recorder = { reference: `Practitioner/${practitionerId}` };
    allergy.extension = [
      {
        url: "http://schemas.canvasmedical.com/fhir/extensions/note-id",
        valueId: noteId,
      },
    ];
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.post("AllergyIntolerance", allergy)
    );
    return response.headers["location"]?.split("/").pop() ?? "";
  }

  async getFirstEncounter(patientId: string): Promise<Encounter> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.get(`Encounter?patient=${patientId}&_sort=-date&_count=1`)
    );
    return response.data.entry[0].resource;
  }

  async getMedication(medicationId: string): Promise<Medication> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.get(`Medication/${medicationId}`)
    );
    return response.data;
  }

  async searchMedication({
    rxNormCode,
    medicationName,
  }: {
    rxNormCode?: string;
    medicationName?: string;
  }): Promise<Bundle> {
    if (!rxNormCode && !medicationName) {
      throw new Error("At least one of rxNormCode or medicationName must be provided");
    }

    let url = "Medication?";
    const params: string[] = [];

    if (rxNormCode) {
      params.push(`code=${RXNORM_SYSTEM}|${rxNormCode}`);
    }

    if (medicationName) {
      params.push(`_text=${encodeURIComponent(medicationName)}`);
    }

    url += params.join("&");

    const response = await this.handleAxiosRequest(() => this.axiosInstanceFhirApi.get(url));
    if (response.data.entry && response.data.entry.length > 0) {
      return response.data.entry;
    }
    throw new Error("Medication not found");
  }

  async getAppointment(appointmentId: string): Promise<AppointmentFhir> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.get(`Appointment/${appointmentId}`)
    );
    return response.data;
  }

  async getPatient({ cxId, patientId }: { cxId: string; patientId: string }): Promise<Patient> {
    const { debug } = out(
      `Canvas getPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientUrl = `/Patient/${patientId}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const patient = await this.makeRequest<Patient>({
      cxId,
      patientId,
      s3Path: "patient",
      method: "GET",
      url: patientUrl,
      schema: patientSchema,
      additionalInfo,
      debug,
      useFhir: true,
    });
    return patient;
  }

  async getFhirResourcesByResource({
    cxId,
    patientId,
    resource,
    useS3 = false,
  }: {
    cxId: string;
    patientId: string;
    resource: FhirResource;
    useS3?: boolean;
  }): Promise<FhirResources> {
    const resourceType = resource.resourceType;
    const params: Record<string, string> = {};
    if (resourceType === "Medication") {
      const code = resource.code.coding[0].code;
      const system = resource.code.coding[0].system;
      if (!code || !system) {
        throw new BadRequestError("Medication resource must have a code", undefined, {
          resource: JSON.stringify(resource),
        });
      }
      params["code"] = `${system}|${code}`;
    }
    return await this.getFhirResourcesByResourceType({
      cxId,
      patientId,
      resourceType,
      extraParams: params,
      useS3,
    });
  }

  async getFhirResourcesByResourceType({
    cxId,
    patientId,
    resourceType,
    extraParams,
    useS3 = false,
  }: {
    cxId: string;
    patientId: string;
    resourceType: SupportedCanvasDiffResource;
    extraParams?: Record<string, string>;
    useS3?: boolean;
  }): Promise<FhirResources> {
    const { debug } = out(
      `Canvas getFhirResourcesByResourceType - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} resourceType ${resourceType}`
    );
    const params = { ...(extraParams ?? {}), patient: `Patient/${patientId}` };
    const urlParams = new URLSearchParams(params);
    const resourceTypeUrl = `/${resourceType}?${urlParams.toString()}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId, resourceType };
    try {
      const makeRequestArgs = {
        cxId,
        patientId,
        s3Path: `fhir-resources-${resourceType}`,
        method: "GET" as const,
        url: resourceTypeUrl,
        schema: fhirResourceBundleSchema,
        additionalInfo,
        debug,
        useFhir: true,
      };
      const bundle = useS3
        ? await this.makeRequestOrUseSavedResponse<FhirResourceBundle>(makeRequestArgs)
        : await this.makeRequest<FhirResourceBundle>(makeRequestArgs);
      const invalidResource = bundle.entry?.find(
        resource => resource.resource.resourceType !== resourceType
      );
      if (invalidResource) {
        throw new MetriportError(`Invalid resource type found`, undefined, {
          invalidResourceType: invalidResource.resource.resourceType,
        });
      }
      return bundle.entry?.map(resource => resource.resource) ?? [];
    } catch (error) {
      if (error instanceof NotFoundError) return [];
      throw error;
    }
  }

  async getAppointments({
    cxId,
    fromDate,
    toDate,
  }: {
    cxId: string;
    fromDate: Date;
    toDate: Date;
  }): Promise<SlimBookedAppointment[]> {
    const { debug } = out(`Canvas getAppointments - cxId ${cxId} practiceId ${this.practiceId}`);
    const params = {
      status: "booked",
      ...(fromDate && { date: `ge${this.formatDate(fromDate.toISOString()) ?? ""}` }),
      ...(toDate && { date: `lt${this.formatDate(toDate.toISOString()) ?? ""}` }),
      _count: "1000",
    };
    const urlParams = new URLSearchParams(params);
    const appointmentUrl = `/Appointment?${urlParams.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
    };
    async function paginateAppointments(
      api: CanvasApi,
      url: string | undefined,
      acc: Appointment[] | undefined = []
    ): Promise<Appointment[]> {
      if (!url) return acc;
      const appointmentListResponse = await api.makeRequest<AppointmentListResponse>({
        cxId,
        s3Path: "appointments",
        method: "GET",
        url,
        schema: appointmentListResponseSchema,
        additionalInfo,
        debug,
        useFhir: true,
      });
      acc.push(...(appointmentListResponse.entry ?? []).map(e => e.resource));
      const nextUrl = appointmentListResponse.link?.find(l => l.relation === "next")?.url;
      return paginateAppointments(api, nextUrl, acc);
    }
    const appointments = await paginateAppointments(this, appointmentUrl);
    const slimBookedAppointments = appointments
      .flatMap(app => {
        // Canvas returns some statuses that are not "booked", so we have further filter
        if (app.status !== "booked") return [];
        const patient = app.participant.find(p => p.actor.type === "Patient");
        if (!patient) return [];
        return [{ patientId: patient.actor.reference.replace("Patient/", "") }];
      })
      .map(a => slimBookedAppointmentSchema.parse(a));
    return slimBookedAppointments;
  }

  private async makeRequest<T>({
    cxId,
    patientId,
    s3Path,
    url,
    method,
    data,
    headers,
    schema,
    additionalInfo,
    debug,
    useFhir = false,
  }: MakeRequestParams<T>): Promise<T> {
    const axiosInstance = useFhir ? this.axiosInstanceFhirApi : this.axiosInstanceCustomApi;
    return await makeRequest<T>({
      ehr: EhrSources.canvas,
      cxId,
      practiceId: this.practiceId,
      patientId,
      s3Path,
      axiosInstance,
      url,
      method,
      data,
      headers,
      schema,
      additionalInfo,
      debug,
    });
  }

  /**
   * Cannot be used for paginated responses
   */
  private async getSavedResponse<T>({
    cxId,
    patientId,
    s3Path,
    schema,
  }: GetSavedResponseFromS3ParamsInEhr<T>): Promise<T | undefined> {
    return await getSavedResponseFromS3<T>({
      ehr: EhrSources.canvas,
      cxId,
      patientId,
      s3Path,
      schema,
    });
  }

  /**
   * Cannot be used for paginated responses
   */
  private async makeRequestOrUseSavedResponse<T>({
    cxId,
    patientId,
    s3Path,
    url,
    method,
    data,
    headers,
    schema,
    additionalInfo,
    debug,
    useFhir = false,
  }: MakeRequestParams<T>): Promise<T> {
    console.log("here2");
    const { log } = out(
      `Canvas makeRequestOrUseSavedResponse - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} s3Path ${s3Path} url ${url}}`
    );
    const response = await this.getSavedResponse<T>({
      cxId,
      patientId,
      s3Path,
      schema,
    });
    if (response) {
      log(`Found cached response for ${s3Path}`);
      return response;
    }
    return await this.makeRequest<T>({
      cxId,
      patientId,
      s3Path,
      method,
      url,
      data,
      headers,
      schema,
      additionalInfo,
      debug,
      useFhir,
    });
  }

  private formatDate(date: string | undefined): string | undefined {
    return formatDate(date, canvasDateFormat);
  }
}

export default CanvasApi;
