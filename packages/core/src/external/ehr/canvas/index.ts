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
  Practitioner as PractitionerFhir,
} from "@medplum/fhirtypes";
import {
  BadRequestError,
  EhrFhirResourceBundle,
  ehrFhirResourceBundleSchema,
  errorToString,
  JwtTokenInfo,
  MetriportError,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  Appointment,
  AppointmentListResponse,
  appointmentListResponseSchema,
  canvasClientJwtTokenResponseSchema,
  Note,
  NoteListResponse,
  noteListResponseSchema,
  noteSchema,
  SlimBookedAppointment,
  slimBookedAppointmentSchema,
} from "@metriport/shared/interface/external/ehr/canvas/index";
import { Patient, patientSchema } from "@metriport/shared/interface/external/ehr/patient";
import {
  Practitioner,
  practitionerSchema,
} from "@metriport/shared/interface/external/ehr/practitioner";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { z } from "zod";
import { RXNORM_URL as RXNORM_SYSTEM } from "../../../util/constants";
import { out } from "../../../util/log";
import {
  ApiConfig,
  fetchEhrBundleUsingCache,
  fetchEhrFhirResourcesWithPagination,
  formatDate,
  getConditionIcd10Coding,
  getConditionStartDate,
  getConditionStatus,
  makeRequest,
  MakeRequestParamsInEhr,
} from "../shared";

dayjs.extend(duration);

interface CanvasApiConfig extends ApiConfig {
  environment: string;
}

const canvasDomainExtension = ".canvasmedical.com";
const canvasDateFormat = "YYYY-MM-DD";
const canvasNoteTitle = "Metriport Chart Import";
const canvasNoteTypeName = "Chart review";
const canvasNoteStatusForWriting = "NEW";
const utcToEstOffset = dayjs.duration(-5, "hours");
const defaultCountOrLimit = "1000";
export type CanvasEnv = string;

export const supportedCanvasResources = [
  "AllergyIntolerance",
  "CarePlan",
  "CareTeam",
  "Condition",
  "Coverage",
  "Device",
  "DiagnosticReport",
  "Encounter",
  "Goal",
  "Immunization",
  "Media",
  "MedicationRequest",
  "MedicationStatement",
  "Observation",
  "Procedure",
];
export const supportedCanvasResourcesById = [
  "Medication",
  "Location",
  "Organization",
  "Patient",
  "Practitioner",
  "Provenance",
];

export type SupportedCanvasResource = (typeof supportedCanvasResources)[number];
export function isSupportedCanvasResource(
  resourceType: string
): resourceType is SupportedCanvasResource {
  return supportedCanvasResources.includes(resourceType);
}

export type SupportedCanvasResourceById = (typeof supportedCanvasResourcesById)[number];
export function isSupportedCanvasResourceById(
  resourceType: string
): resourceType is SupportedCanvasResourceById {
  return supportedCanvasResourcesById.includes(resourceType);
}

const problemStatusesMap = new Map<string, string>();
problemStatusesMap.set("active", "active");
problemStatusesMap.set("relapse", "active");
problemStatusesMap.set("recurrence", "active");
problemStatusesMap.set("remission", "resolved");
problemStatusesMap.set("resolved", "resolved");
problemStatusesMap.set("inactive", "resolved");

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

  async getPractitionerLegacy(name: string): Promise<PractitionerFhir> {
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

  async createNoteLegacy({
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

  async createConditionLegacy({
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

  async getPractitioner({
    cxId,
    patientId,
    practitionerId,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
  }): Promise<Practitioner> {
    const { debug } = out(
      `Canvas getPractitioner - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} practitionerId ${practitionerId}`
    );
    const practitionerUrl = `/Practitioner/${practitionerId}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId, practitionerId };
    const practitioner = await this.makeRequest<Practitioner>({
      cxId,
      patientId,
      s3Path: "practitioner",
      method: "GET",
      url: practitionerUrl,
      schema: practitionerSchema,
      additionalInfo,
      debug,
      useFhir: true,
    });
    return practitioner;
  }

  async createNote({
    cxId,
    patientId,
    practitionerId,
    practiceLocationId,
    title,
    noteType,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
    practiceLocationId: string;
    title: string;
    noteType: string;
  }): Promise<Note> {
    const { debug } = out(
      `Canvas createNote - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} practitionerId ${practitionerId}`
    );
    const noteUrl = "notes/v1/Note";
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      practitionerId,
      practiceLocationId,
      title,
      noteType,
    };
    const data = {
      title,
      noteTypeName: noteType,
      patientKey: patientId,
      providerKey: practitionerId,
      practiceLocationKey: practiceLocationId,
      encounterStartTime: buildDayjs().toISOString(),
    };

    const note = await this.makeRequest<Note>({
      cxId,
      patientId,
      s3Path: "create-note",
      method: "POST",
      url: noteUrl,
      data,
      schema: noteSchema,
      additionalInfo,
      headers: { "content-type": "application/json" },
      debug,
    });
    return note;
  }

  async listNotes({
    cxId,
    patientId,
    practitionerId,
    noteType,
    fromDate,
    toDate,
    orderDec = false,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
    noteType: string;
    fromDate: Date;
    toDate: Date;
    orderDec?: boolean;
  }): Promise<Note[]> {
    const { debug } = out(
      `Canvas listNotes - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} practitionerId ${practitionerId}`
    );
    const params = {
      note_type_name: noteType,
      patient_key: patientId,
      provider_key: practitionerId,
      datetime_of_service__gte: fromDate.toISOString(),
      datetime_of_service__lte: toDate.toISOString(),
      limit: defaultCountOrLimit,
      ordering: orderDec ? "-datetime_of_service" : "datetime_of_service",
    };
    const urlParams = new URLSearchParams(params);
    const noteUrl = `notes/v1/Note?${urlParams.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      practitionerId,
      noteType,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
    };
    async function paginateNotes(
      api: CanvasApi,
      url: string | null | undefined,
      acc: Note[] | undefined = []
    ): Promise<Note[]> {
      if (!url) return acc;
      const notesListResponse = await api.makeRequest<NoteListResponse>({
        cxId,
        patientId,
        s3Path: "notes",
        method: "GET",
        url,
        schema: noteListResponseSchema,
        additionalInfo,
        headers: { "content-type": "application/json" },
        debug,
      });
      acc.push(...(notesListResponse.results ?? []));
      const nextUrl = notesListResponse.next;
      return paginateNotes(api, nextUrl, acc);
    }
    const notes = await paginateNotes(this, noteUrl);
    return notes;
  }

  async getOrCreateMetriportImportNote({
    cxId,
    patientId,
    practitionerId,
    practiceLocationId,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
    practiceLocationId: string;
  }): Promise<Note> {
    const notes = await this.listNotes({
      cxId,
      patientId,
      practitionerId,
      noteType: canvasNoteTypeName,
      fromDate: buildDayjs().subtract(1, "day").toDate(),
      toDate: buildDayjs().toDate(),
      orderDec: true,
    });
    const note = notes.find(
      n =>
        n.title === canvasNoteTitle &&
        n.practiceLocationKey === practiceLocationId &&
        n.currentState === canvasNoteStatusForWriting
    );
    if (note) {
      const noteCreatedAtEst = buildDayjs(note.datetimeOfService).add(utcToEstOffset);
      const nowEst = buildDayjs().add(utcToEstOffset);
      const noteCreatedToday =
        noteCreatedAtEst.format("YYYY-MM-DD") === nowEst.format("YYYY-MM-DD");
      if (noteCreatedToday) return note;
    }
    const newNote = await this.createNote({
      cxId,
      patientId,
      practitionerId,
      practiceLocationId,
      title: canvasNoteTitle,
      noteType: canvasNoteTypeName,
    });
    return newNote;
  }

  async getPractitionerPrimaryLocation({
    cxId,
    patientId,
    practitionerId,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
  }): Promise<string> {
    const practitioner = await this.getPractitioner({
      cxId,
      patientId,
      practitionerId,
    });
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId, practitionerId };
    if (!practitioner.extension) {
      throw new BadRequestError(
        "Practitioner does not have a primary location",
        undefined,
        additionalInfo
      );
    }
    const primaryLocation = practitioner.extension.find(
      e =>
        e.url ===
        "http://schemas.canvasmedical.com/fhir/extensions/practitioner-primary-practice-location"
    );
    if (!primaryLocation) {
      throw new BadRequestError(
        "Practitioner does not have a primary location",
        undefined,
        additionalInfo
      );
    }
    const valueReference = primaryLocation.valueReference;
    if (!valueReference) {
      throw new BadRequestError(
        "Practitioner primary location value reference is missing",
        undefined,
        additionalInfo
      );
    }
    if (!valueReference.type || valueReference.type !== "Location") {
      throw new BadRequestError(
        "Practitioner primary location type is missing or is not a location",
        undefined,
        additionalInfo
      );
    }
    if (!valueReference.reference) {
      throw new BadRequestError(
        "Practitioner primary location reference is missing",
        undefined,
        additionalInfo
      );
    }
    const locationId = valueReference.reference.split("/")[1];
    if (!locationId) {
      throw new BadRequestError(
        "Practitioner primary location ID is missing",
        undefined,
        additionalInfo
      );
    }
    return locationId;
  }

  async createCondition({
    cxId,
    patientId,
    practitionerId,
    condition,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
    condition: Condition;
  }): Promise<void> {
    const { debug } = out(
      `Canvas createCondition - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      conditionId: condition.id,
    };
    const formattedCondition = this.formatCondition(condition, additionalInfo);
    const practiceLocationId = await this.getPractitionerPrimaryLocation({
      cxId,
      patientId,
      practitionerId,
    });
    const note = await this.getOrCreateMetriportImportNote({
      cxId,
      patientId,
      practitionerId,
      practiceLocationId,
    });
    const noteId = note.noteKey;
    const conditionUrl = `/Condition`;
    formattedCondition.subject = { reference: `Patient/${patientId}` };
    formattedCondition.recorder = { reference: `Practitioner/${practitionerId}` };
    formattedCondition.extension = [
      ...(formattedCondition.extension ?? []),
      {
        url: "http://schemas.canvasmedical.com/fhir/extensions/note-id",
        valueId: noteId,
      },
    ];
    await this.makeRequest<undefined>({
      cxId,
      patientId,
      s3Path: `fhir/condition/${additionalInfo.conditionId}`,
      method: "POST",
      url: conditionUrl,
      data: { ...formattedCondition },
      schema: z.undefined(),
      additionalInfo: { ...additionalInfo, noteId },
      headers: { "content-type": "application/json" },
      debug,
      useFhir: true,
      emptyResponse: true,
    });
  }

  async getBundleByResourceType({
    cxId,
    metriportPatientId,
    canvasPatientId,
    resourceType,
    useCachedBundle = true,
  }: {
    cxId: string;
    metriportPatientId: string;
    canvasPatientId: string;
    resourceType: string;
    useCachedBundle?: boolean;
  }): Promise<Bundle> {
    const { debug } = out(
      `Canvas getBundleByResourceType - cxId ${cxId} practiceId ${this.practiceId} canvasPatientId ${canvasPatientId}`
    );
    if (!isSupportedCanvasResource(resourceType)) {
      throw new BadRequestError("Invalid resource type", undefined, {
        resourceType,
      });
    }
    const params = { patient: `Patient/${canvasPatientId}`, _count: defaultCountOrLimit };
    const urlParams = new URLSearchParams(params);
    const resourceTypeUrl = `/${resourceType}?${urlParams.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId: canvasPatientId,
      resourceType,
    };
    const fetchResourcesFromEhr = () =>
      fetchEhrFhirResourcesWithPagination({
        makeRequest: async (url: string) => {
          const bundle = await this.makeRequest<EhrFhirResourceBundle>({
            cxId,
            patientId: canvasPatientId,
            s3Path: `fhir-resources-${resourceType}`,
            method: "GET",
            url,
            schema: ehrFhirResourceBundleSchema,
            additionalInfo,
            debug,
            useFhir: true,
          });
          const invalidResource = bundle.entry?.find(e => e.resource.resourceType !== resourceType);
          if (invalidResource) {
            throw new BadRequestError("Invalid bundle", undefined, {
              resourceType,
              resourceTypeInBundle: invalidResource.resource.resourceType,
            });
          }
          return bundle;
        },
        url: resourceTypeUrl,
      });
    const bundle = await fetchEhrBundleUsingCache({
      ehr: EhrSources.canvas,
      cxId,
      metriportPatientId,
      ehrPatientId: canvasPatientId,
      resourceType,
      fetchResourcesFromEhr,
      useCachedBundle,
    });
    return bundle;
  }

  async getResourceBundleByResourceId({
    cxId,
    metriportPatientId,
    canvasPatientId,
    resourceType,
    resourceId,
    useCachedBundle = true,
  }: {
    cxId: string;
    metriportPatientId: string;
    canvasPatientId: string;
    resourceType: string;
    resourceId: string;
    useCachedBundle?: boolean;
  }): Promise<Bundle> {
    const { debug } = out(
      `Canvas getResourceBundleByResourceId - cxId ${cxId} practiceId ${this.practiceId} metriportPatientId ${metriportPatientId} canvasPatientId ${canvasPatientId} resourceType ${resourceType}`
    );
    if (!isSupportedCanvasResource(resourceType) && !isSupportedCanvasResourceById(resourceType)) {
      throw new BadRequestError("Invalid resource type", undefined, {
        canvasPatientId,
        resourceId,
        resourceType,
      });
    }
    const params = { _id: resourceId };
    const urlParams = new URLSearchParams(params);
    const resourceTypeUrl = `/${resourceType}?${urlParams.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId: canvasPatientId,
      resourceType,
      resourceId,
    };
    const fetchResourcesFromEhr = () =>
      fetchEhrFhirResourcesWithPagination({
        makeRequest: (url: string) =>
          this.makeRequest<EhrFhirResourceBundle>({
            cxId,
            patientId: canvasPatientId,
            s3Path: `fhir-resources-${resourceType}/resourceId/${resourceId}`,
            method: "GET",
            url,
            schema: ehrFhirResourceBundleSchema,
            additionalInfo,
            debug,
            useFhir: true,
          }),
        url: resourceTypeUrl,
      });
    const bundle = await fetchEhrBundleUsingCache({
      ehr: EhrSources.canvas,
      cxId,
      metriportPatientId,
      ehrPatientId: canvasPatientId,
      resourceType,
      resourceId,
      fetchResourcesFromEhr,
      useCachedBundle,
    });
    return bundle;
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
      _count: defaultCountOrLimit,
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
    emptyResponse = false,
    useFhir = false,
  }: MakeRequestParamsInEhr<T> & { useFhir?: boolean }): Promise<T> {
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
      emptyResponse,
    });
  }

  private formatDate(date: string | undefined): string | undefined {
    return formatDate(date, canvasDateFormat);
  }

  private formatCondition(
    condition: Condition,
    additionalInfo: Record<string, string | undefined>
  ): Condition {
    const formattedCondition: Condition = {
      resourceType: "Condition",
      ...(condition.id ? { id: condition.id } : {}),
      ...(condition.subject ? { subject: condition.subject } : {}),
      ...(condition.recorder ? { recorder: condition.recorder } : {}),
      ...(condition.meta ? { meta: condition.meta } : {}),
      ...(condition.extension ? { extension: condition.extension } : {}),
    };
    const icd10Coding = getConditionIcd10Coding(condition);
    if (!icd10Coding) {
      throw new BadRequestError("No ICD-10 code found for condition", undefined, additionalInfo);
    }
    if (!icd10Coding.code) {
      throw new BadRequestError("No code found for ICD-10 coding", undefined, additionalInfo);
    }
    if (!icd10Coding.display) {
      throw new BadRequestError("No display found for ICD-10 coding", undefined, additionalInfo);
    }
    formattedCondition.code = {
      coding: [
        {
          code: icd10Coding.code,
          system: "http://hl7.org/fhir/sid/icd-10-cm",
          display: icd10Coding.display,
        },
      ],
    };
    const startDate = getConditionStartDate(condition);
    const formattedStartDate = formatDate(startDate, canvasDateFormat);
    if (!formattedStartDate) {
      throw new BadRequestError("No start date found for condition", undefined, additionalInfo);
    }
    formattedCondition.onsetDateTime = formattedStartDate;
    const conditionStatus = getConditionStatus(condition);
    const problemStatus = conditionStatus
      ? problemStatusesMap.get(conditionStatus.toLowerCase())
      : undefined;
    if (!problemStatus) {
      throw new BadRequestError("No problem status found for condition", undefined, additionalInfo);
    }
    formattedCondition.clinicalStatus = {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: problemStatus,
        },
      ],
    };
    formattedCondition.category = [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-category",
            code: "encounter-diagnosis",
          },
        ],
      },
    ];
    return formattedCondition;
  }
}

export default CanvasApi;
