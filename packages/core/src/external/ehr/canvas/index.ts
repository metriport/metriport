import {
  AllergyIntolerance,
  Bundle,
  Coding,
  Condition,
  Extension,
  Immunization,
  Medication,
  MedicationStatement,
  Observation,
  ResourceType,
} from "@medplum/fhirtypes";
import {
  BadRequestError,
  errorToString,
  JwtTokenInfo,
  MetriportError,
  NotFoundError,
  sleep,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  AllergenResource,
  allergenResourceSchema,
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
import {
  EhrFhirResourceBundle,
  ehrFhirResourceBundleSchema,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { Patient, patientSchema } from "@metriport/shared/interface/external/ehr/patient";
import {
  Practitioner,
  practitionerSchema,
} from "@metriport/shared/interface/external/ehr/practitioner";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosInstance } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniqBy } from "lodash";
import { z } from "zod";
import { ObservationStatus } from "../../../fhir-deduplication/resources/observation-shared";
import { fetchCodingCodeOrDisplayOrSystem } from "../../../fhir-deduplication/shared";
import { executeAsynchronously } from "../../../util/concurrency";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import {
  ApiConfig,
  convertEhrBundleToValidEhrStrictBundle,
  DataPoint,
  fetchEhrBundleUsingCache,
  fetchEhrFhirResourcesWithPagination,
  formatDate,
  getAllergyIntoleranceOnsetDate,
  getAllergyIntoleranceSubstanceRxnormCoding,
  getConditionIcd10Coding,
  getConditionStartDate,
  getConditionStatus,
  getImmunizationAdministerDate,
  getImmunizationCvxCoding,
  getMedicationRxnormCoding,
  getMedicationStatementStartDate,
  getObservationLoincCoding,
  getObservationResultStatus,
  getObservationUnit,
  GroupedVitals,
  makeRequest,
  MakeRequestParamsInEhr,
  MedicationWithRefs,
  paginateWaitTime,
  partitionEhrBundle,
  saveEhrReferenceBundle,
} from "../shared";
import { convertCodeAndValue } from "../unit-conversion";

dayjs.extend(duration);

const parallelRequests = 5;
const maxJitter = dayjs.duration(2, "seconds");

interface CanvasApiConfig extends ApiConfig {
  environment: string;
}

const canvasDomainExtension = ".canvasmedical.com";
const canvasDateFormat = "YYYY-MM-DD";
const canvasDateTimeFormat = "YYYY-MM-DDTHH:mm:ss.SSSZ";
const canvasNoteTitle = "Metriport Chart Import";
const canvasNoteTypeName = "Chart review";
const canvasNoteStatusForWriting = "NEW";
const FDB_CODE = "fdb";
const utcToEstOffset = dayjs.duration(-5, "hours");
const defaultCountOrLimit = 1000;
export type CanvasEnv = string;

export const supportedCanvasResources: ResourceType[] = [
  "AllergyIntolerance",
  "Condition",
  "DiagnosticReport",
  "Encounter",
  "Immunization",
  "MedicationRequest",
  "MedicationStatement",
  "Observation",
  "Procedure",
];
export const supportedCanvasReferenceResources: ResourceType[] = [
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
  return supportedCanvasResources.includes(resourceType as ResourceType);
}

export type SupportedCanvasReferenceResource = (typeof supportedCanvasReferenceResources)[number];
export function isSupportedCanvasReferenceResource(
  resourceType: string
): resourceType is SupportedCanvasReferenceResource {
  return supportedCanvasReferenceResources.includes(resourceType as ResourceType);
}

const problemStatusesMap = new Map<string, string>();
problemStatusesMap.set("active", "active");
problemStatusesMap.set("relapse", "active");
problemStatusesMap.set("recurrence", "active");
problemStatusesMap.set("remission", "resolved");
problemStatusesMap.set("resolved", "resolved");
problemStatusesMap.set("inactive", "resolved");

const vitalSignCodesMap = new Map<string, { codeKey: string; targetUnits: string }>();
vitalSignCodesMap.set("8310-5", { codeKey: "temperature", targetUnits: "degf" });
vitalSignCodesMap.set("8867-4", { codeKey: "pulserate", targetUnits: "bpm" });
vitalSignCodesMap.set("9279-1", { codeKey: "respirationrate", targetUnits: "bpm" });
vitalSignCodesMap.set("2708-6", { codeKey: "oxygensaturationarterial", targetUnits: "%" });
vitalSignCodesMap.set("59408-5", { codeKey: "oxygensaturation", targetUnits: "%" });
vitalSignCodesMap.set("8462-4", { codeKey: "bloodpressure.diastolic", targetUnits: "mmHg" });
vitalSignCodesMap.set("8480-6", { codeKey: "bloodpressure.systolic", targetUnits: "mmHg" });
vitalSignCodesMap.set("29463-7", { codeKey: "weight", targetUnits: "kg" });
vitalSignCodesMap.set("8302-2", { codeKey: "height", targetUnits: "cm" });
vitalSignCodesMap.set("56086-2", { codeKey: "waistcircumference", targetUnits: "cm" });

const bpDiastolicCode = "8462-4";
const bpSystolicCode = "8480-6";

const medicationStatementStatuses = ["active", "entered-in-error", "stopped"];
const immunizationStatuses = ["completed", "entered-in-error", "not-done"];
const allergyIntoleranceClinicalStatuses = ["active", "inactive"];
const allergyIntoleranceVerificationStatuses = ["confirmed", "entered-in-error"];
const allergyIntoleranceSeverityCodes = ["mild", "moderate", "severe"];
const observationResultStatuses = ["final", "unknown", "entered-in-error"];

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
      limit: defaultCountOrLimit.toString(),
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

  async getNoteIdForWriteback({
    cxId,
    patientId,
    practitionerId,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
  }): Promise<string> {
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
    return noteId;
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
    const conditionUrl = `/Condition`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      conditionId: condition.id,
    };
    const formattedCondition = this.formatCondition(condition, additionalInfo);
    const noteId = await this.getNoteIdForWriteback({
      cxId,
      patientId,
      practitionerId,
    });
    formattedCondition.subject = { reference: `Patient/${patientId}` };
    formattedCondition.recorder = { reference: `Practitioner/${practitionerId}` };
    formattedCondition.extension = [
      ...(formattedCondition.extension ?? []),
      this.formatNoteIdExtension(noteId),
    ];
    await this.makeRequest<undefined>({
      cxId,
      patientId,
      s3Path: this.createWriteBackPath("condition", additionalInfo.conditionId),
      method: "POST",
      data: { ...formattedCondition },
      url: conditionUrl,
      schema: z.undefined(),
      additionalInfo: { ...additionalInfo, noteId },
      headers: { "content-type": "application/json" },
      debug,
      useFhir: true,
      emptyResponse: true,
    });
  }

  async createMedicationStatements({
    cxId,
    patientId,
    practitionerId,
    medicationWithRefs,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
    medicationWithRefs: MedicationWithRefs;
  }): Promise<void> {
    const { log, debug } = out(
      `Canvas createMedicationStatements - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} practitionerId ${practitionerId}`
    );
    const medicationStatementUrl = `/MedicationStatement`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      medicationId: medicationWithRefs.medication.id,
    };
    if (medicationWithRefs.statement.length < 1) {
      throw new BadRequestError("No medication statements found", undefined, additionalInfo);
    }
    const rxnormCoding = getMedicationRxnormCoding(medicationWithRefs.medication);
    if (!rxnormCoding) {
      throw new BadRequestError("No RXNORM code found for medication", undefined, additionalInfo);
    }
    const rxnormCodingDisplay = rxnormCoding.display;
    if (!rxnormCodingDisplay) {
      throw new BadRequestError("Medication does not have a display", undefined, additionalInfo);
    }
    const medicationReference = await this.searchForMedicationByRxNorm({
      cxId,
      patientId,
      practitionerId,
      rxnormCoding,
    });
    if (!medicationReference) {
      throw new BadRequestError("Medication reference not found", undefined, additionalInfo);
    }
    const medicationReferenceId = medicationReference.id;
    if (!medicationReferenceId) {
      throw new BadRequestError("Medication reference ID is missing", undefined, additionalInfo);
    }
    const noteId = await this.getNoteIdForWriteback({
      cxId,
      patientId,
      practitionerId,
    });
    const createMedicationStatementsErrors: { error: unknown; medicationStatement: string }[] = [];
    const createMedicationStatementsArgs: MedicationStatement[] =
      medicationWithRefs.statement.flatMap(statement => {
        const formattedMedicationStatement = this.formatMedicationStatement(statement);
        if (!formattedMedicationStatement) return [];
        formattedMedicationStatement.medicationReference = {
          reference: `Medication/${medicationReferenceId}`,
          display: rxnormCodingDisplay,
        };
        formattedMedicationStatement.subject = { reference: `Patient/${patientId}` };
        formattedMedicationStatement.extension = [
          ...(formattedMedicationStatement.extension ?? []),
          this.formatNoteIdExtension(noteId),
        ];
        return formattedMedicationStatement;
      });
    if (createMedicationStatementsArgs.length < 1) {
      throw new BadRequestError("No valid medication statements found", undefined, additionalInfo);
    }
    const sortedCreateMedicationStatementsArgs = this.sortMedicationStatementsNewestFirst(
      createMedicationStatementsArgs
    );
    await executeAsynchronously(
      sortedCreateMedicationStatementsArgs.slice(0, 1),
      async (params: MedicationStatement) => {
        try {
          await this.makeRequest<undefined>({
            cxId,
            patientId,
            s3Path: this.createWriteBackPath("medication-statement", additionalInfo.medicationId),
            method: "POST",
            url: medicationStatementUrl,
            data: { ...params },
            schema: z.undefined(),
            additionalInfo: { ...additionalInfo, noteId },
            headers: { "content-type": "application/json" },
            debug,
            useFhir: true,
            emptyResponse: true,
          });
        } catch (error) {
          if (error instanceof BadRequestError || error instanceof NotFoundError) return;
          const medicationStatementToString = JSON.stringify(params);
          log(
            `Failed to create medication statement ${medicationStatementToString}. Cause: ${errorToString(
              error
            )}`
          );
          createMedicationStatementsErrors.push({
            error,
            medicationStatement: medicationStatementToString,
          });
        }
      },
      {
        numberOfParallelExecutions: parallelRequests,
        maxJitterMillis: maxJitter.asMilliseconds(),
      }
    );
    if (createMedicationStatementsErrors.length > 0) {
      const msg = "Failure while creating some medication statements @ Canvas";
      capture.message(msg, {
        extra: {
          ...additionalInfo,
          createMedicationStatementsArgsCount: createMedicationStatementsArgs.length,
          createMedicationStatementsErrorsCount: createMedicationStatementsErrors.length,
          errors: createMedicationStatementsErrors,
          context: "canvas.create-medication",
        },
        level: "warning",
      });
    }
  }

  async createImmunization({
    cxId,
    patientId,
    practitionerId,
    immunization,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
    immunization: Immunization;
  }): Promise<void> {
    const { debug } = out(
      `Canvas createImmunization - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} practitionerId ${practitionerId}`
    );
    const immunizationUrl = `/Immunization`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      immunizationId: immunization.id,
    };
    const formattedImmunization = this.formatImmunization(immunization, additionalInfo);
    const noteId = await this.getNoteIdForWriteback({
      cxId,
      patientId,
      practitionerId,
    });
    formattedImmunization.patient = { reference: `Patient/${patientId}` };
    formattedImmunization.extension = [
      ...(formattedImmunization.extension ?? []),
      this.formatNoteIdExtension(noteId),
    ];
    await this.makeRequest<undefined>({
      cxId,
      patientId,
      s3Path: this.createWriteBackPath("immunization", additionalInfo.immunizationId),
      method: "POST",
      data: { ...formattedImmunization },
      url: immunizationUrl,
      schema: z.undefined(),
      additionalInfo: { ...additionalInfo, noteId },
      headers: { "content-type": "application/json" },
      debug,
      useFhir: true,
      emptyResponse: true,
    });
  }

  async createAllergyIntolerance({
    cxId,
    patientId,
    practitionerId,
    allergyIntolerance,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
    allergyIntolerance: AllergyIntolerance;
  }): Promise<void> {
    const { debug } = out(
      `Canvas createAllergyIntolerance - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} practitionerId ${practitionerId}`
    );
    const allergyIntoleranceUrl = `/AllergyIntolerance`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      allergyIntoleranceId: allergyIntolerance.id,
    };
    const reaction = allergyIntolerance.reaction;
    if (!reaction || reaction.length < 1) {
      throw new BadRequestError("No reactions found for allergy", undefined, additionalInfo);
    }
    const codingWithSeverityPairs: [Coding, string | undefined][] = reaction.flatMap(r => {
      const substanceRxnormCoding = getAllergyIntoleranceSubstanceRxnormCoding(r);
      if (!substanceRxnormCoding) return [];
      return [[substanceRxnormCoding, r.severity]];
    });
    const codingWithSeverityPair = codingWithSeverityPairs[0];
    if (!codingWithSeverityPair) {
      throw new BadRequestError(
        "No RXNORM code found for allergy reaction",
        undefined,
        additionalInfo
      );
    }
    const [substanceRxnormCoding, severity] = codingWithSeverityPair;
    const allergenReference = await this.searchForAllergenByRxNorm({
      cxId,
      patientId,
      practitionerId,
      rxnormCoding: substanceRxnormCoding,
    });
    if (!allergenReference) {
      throw new BadRequestError("No allergen option found via search", undefined, additionalInfo);
    }
    const formattedAllergyIntolerance = this.formatAllergyIntolerance(
      allergyIntolerance,
      allergenReference,
      severity,
      additionalInfo
    );
    const noteId = await this.getNoteIdForWriteback({
      cxId,
      patientId,
      practitionerId,
    });
    formattedAllergyIntolerance.patient = { reference: `Patient/${patientId}` };
    formattedAllergyIntolerance.recorder = { reference: `Practitioner/${practitionerId}` };
    formattedAllergyIntolerance.extension = [
      ...(formattedAllergyIntolerance.extension ?? []),
      this.formatNoteIdExtension(noteId),
    ];
    await this.makeRequest<undefined>({
      cxId,
      patientId,
      s3Path: this.createWriteBackPath("allergy-intolerance", additionalInfo.allergyIntoleranceId),
      method: "POST",
      url: allergyIntoleranceUrl,
      data: { ...formattedAllergyIntolerance },
      schema: z.undefined(),
      additionalInfo: { ...additionalInfo, noteId },
      headers: { "content-type": "application/json" },
      debug,
      useFhir: true,
      emptyResponse: true,
    });
  }

  async createVitals({
    cxId,
    patientId,
    practitionerId,
    vitals,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
    vitals: GroupedVitals;
  }): Promise<void> {
    const { log, debug } = out(
      `Canvas createVitals - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} practitionerId ${practitionerId}`
    );
    const observationsUrl = `/Observation`;
    const observation = vitals.mostRecentObservation;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      observationId: observation.id,
    };
    if (!vitals.sortedPoints || vitals.sortedPoints.length < 1) {
      throw new BadRequestError("No points found for vitals", undefined, additionalInfo);
    }
    if (uniqBy(vitals.sortedPoints, "date").length !== vitals.sortedPoints.length) {
      throw new BadRequestError("Duplicate reading taken for vitals", undefined, {
        ...additionalInfo,
        dates: vitals.sortedPoints.map(v => v.date).join(", "),
      });
    }
    const noteId = await this.getNoteIdForWriteback({
      cxId,
      patientId,
      practitionerId,
    });
    const createObservationsErrors: {
      error: unknown;
      observation: string;
    }[] = [];
    const createObservationsArgs: Observation[] = vitals.sortedPoints.flatMap(point => {
      const formattedPoint = this.formatVitalDataPoint(observation, point, additionalInfo);
      if (!formattedPoint) return [];
      formattedPoint.subject = { reference: `Patient/${patientId}` };
      formattedPoint.extension = [
        ...(formattedPoint.extension ?? []),
        this.formatNoteIdExtension(noteId),
      ];
      return [formattedPoint];
    });
    if (createObservationsArgs.length < 1) {
      throw new BadRequestError("No valid vitals data found", undefined, additionalInfo);
    }
    await executeAsynchronously(
      createObservationsArgs,
      async (params: Observation) => {
        try {
          await this.makeRequest<undefined>({
            cxId,
            patientId,
            s3Path: this.createWriteBackPath("observations", additionalInfo.observationId),
            method: "POST",
            url: observationsUrl,
            data: { ...params },
            schema: z.undefined(),
            additionalInfo: { ...additionalInfo, noteId },
            headers: { "content-type": "application/json" },
            debug,
            useFhir: true,
            emptyResponse: true,
          });
        } catch (error) {
          if (error instanceof BadRequestError || error instanceof NotFoundError) return;
          const observationToString = JSON.stringify(params);
          log(
            `Failed to create observation ${observationToString}. Cause: ${errorToString(error)}`
          );
          createObservationsErrors.push({ error, observation: observationToString });
        }
      },
      {
        numberOfParallelExecutions: parallelRequests,
        maxJitterMillis: maxJitter.asMilliseconds(),
      }
    );
    if (createObservationsErrors.length > 0) {
      const msg = "Failure while creating some vitals observations @ Canvas";
      capture.message(msg, {
        extra: {
          ...additionalInfo,
          createObservationsArgsCount: createObservationsArgs.length,
          createObservationsErrorsCount: createObservationsErrors.length,
          errors: createObservationsErrors,
          context: "canvas.create-vitals",
        },
        level: "warning",
      });
    }
  }

  async searchForMedicationByRxNorm({
    cxId,
    patientId,
    practitionerId,
    rxnormCoding,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
    rxnormCoding: Coding;
  }): Promise<Medication | undefined> {
    const { debug } = out(
      `Canvas searchForMedicationByRxNorm - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} practitionerId ${practitionerId} rxnormCoding ${rxnormCoding}`
    );
    if (!rxnormCoding.system || !rxnormCoding.code) return undefined;
    const code = `${rxnormCoding.system}|${rxnormCoding.code}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId, practitionerId, code };
    const params = { code: `${rxnormCoding.system}|${rxnormCoding.code}` };
    const urlParams = new URLSearchParams(params);
    const medicationUrl = `/Medication?${urlParams.toString()}`;
    const medicationBundle = await this.makeRequest<EhrFhirResourceBundle>({
      cxId,
      patientId,
      s3Path: this.createReferencePath("medication-reference", code),
      method: "GET",
      url: medicationUrl,
      schema: ehrFhirResourceBundleSchema,
      additionalInfo,
      headers: { "content-type": "application/json" },
      debug,
      useFhir: true,
    });
    const medicationReference = medicationBundle.entry?.[0]?.resource;
    if (!medicationReference) {
      throw new BadRequestError("Medication not found", undefined, additionalInfo);
    }
    return medicationReference as Medication;
  }

  async searchForAllergenByRxNorm({
    cxId,
    patientId,
    practitionerId,
    rxnormCoding,
  }: {
    cxId: string;
    patientId: string;
    practitionerId: string;
    rxnormCoding: Coding;
  }): Promise<AllergenResource | undefined> {
    const { debug } = out(
      `Canvas searchForAllergenByRxNorm - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} practitionerId ${practitionerId} rxnormCoding ${rxnormCoding}`
    );
    if (!rxnormCoding.system || !rxnormCoding.code) return undefined;
    const code = `${rxnormCoding.system}|${rxnormCoding.code}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId, practitionerId, code };
    const params = { code: `${rxnormCoding.system}|${rxnormCoding.code}` };
    const urlParams = new URLSearchParams(params);
    const allergenUrl = `/Allergen?${urlParams.toString()}`;
    const allergenBundle = await this.makeRequest<EhrFhirResourceBundle>({
      cxId,
      patientId,
      s3Path: this.createReferencePath("allergen-reference", code),
      method: "GET",
      url: allergenUrl,
      schema: ehrFhirResourceBundleSchema,
      additionalInfo,
      headers: { "content-type": "application/json" },
      debug,
      useFhir: true,
    });
    const allergenReference = allergenBundle.entry?.[0]?.resource;
    if (!allergenReference) return undefined;
    const parsedAllergenReference = allergenResourceSchema.safeParse(allergenReference);
    if (!parsedAllergenReference.success) return undefined;
    return parsedAllergenReference.data;
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
    const params = {
      patient: `Patient/${canvasPatientId}`,
      _count: defaultCountOrLimit.toString(),
    };
    const urlParams = new URLSearchParams(params);
    const resourceTypeUrl = `/${resourceType}?${urlParams.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId: canvasPatientId,
      resourceType,
    };
    let referenceBundleToSave: EhrFhirResourceBundle | undefined;
    const client = this; // eslint-disable-line @typescript-eslint/no-this-alias
    function fetchResourcesFromEhr() {
      return fetchEhrFhirResourcesWithPagination({
        makeRequest: async (url: string) => {
          const bundle = await client.makeRequest<EhrFhirResourceBundle>({
            cxId,
            patientId: canvasPatientId,
            s3Path: client.createFhirPath(resourceType),
            method: "GET",
            url,
            schema: ehrFhirResourceBundleSchema,
            additionalInfo,
            debug,
            useFhir: true,
          });
          const { targetBundle, referenceBundle } = partitionEhrBundle({
            bundle,
            resourceType,
          });
          referenceBundleToSave = referenceBundle;
          return convertEhrBundleToValidEhrStrictBundle(
            targetBundle,
            resourceType,
            canvasPatientId
          );
        },
        url: resourceTypeUrl,
      });
    }
    const bundle = await fetchEhrBundleUsingCache({
      ehr: EhrSources.canvas,
      cxId,
      metriportPatientId,
      ehrPatientId: canvasPatientId,
      resourceType,
      fetchResourcesFromEhr,
      useCachedBundle,
    });
    if (referenceBundleToSave) {
      await saveEhrReferenceBundle({
        ehr: EhrSources.canvas,
        cxId,
        metriportPatientId,
        ehrPatientId: canvasPatientId,
        referenceBundle: referenceBundleToSave,
      });
    }
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
    if (
      !isSupportedCanvasResource(resourceType) &&
      !isSupportedCanvasReferenceResource(resourceType)
    ) {
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
    const client = this; // eslint-disable-line @typescript-eslint/no-this-alias
    function fetchResourcesFromEhr() {
      return fetchEhrFhirResourcesWithPagination({
        makeRequest: async (url: string) => {
          const bundle = await client.makeRequest<EhrFhirResourceBundle>({
            cxId,
            patientId: canvasPatientId,
            s3Path: client.createFhirPath(resourceType, resourceId),
            method: "GET",
            url,
            schema: ehrFhirResourceBundleSchema,
            additionalInfo,
            debug,
            useFhir: true,
          });
          return convertEhrBundleToValidEhrStrictBundle(bundle, resourceType, canvasPatientId);
        },
        url: resourceTypeUrl,
      });
    }
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
    const params = { status: "booked", _count: defaultCountOrLimit.toString() };
    const urlParams = new URLSearchParams(params);
    urlParams.append("date", `ge${this.formatDate(fromDate.toISOString())}`);
    urlParams.append("date", `lt${this.formatDate(toDate.toISOString())}`);
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
      await sleep(paginateWaitTime.asMilliseconds());
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

  private formatDateTime(date: string | undefined): string | undefined {
    return formatDate(date, canvasDateTimeFormat);
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
    const formattedStartDate = this.formatDate(startDate);
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

  private formatMedicationStatement(
    medicationStatement: MedicationStatement
  ): MedicationStatement | undefined {
    const formattedMedicationStatement: MedicationStatement = {
      resourceType: "MedicationStatement",
      ...(medicationStatement.id ? { id: medicationStatement.id } : {}),
      ...(medicationStatement.subject ? { subject: medicationStatement.subject } : {}),
      ...(medicationStatement.meta ? { meta: medicationStatement.meta } : {}),
      ...(medicationStatement.extension ? { extension: medicationStatement.extension } : {}),
    };
    const startDate = getMedicationStatementStartDate(medicationStatement);
    const formattedStartDateTime = this.formatDateTime(startDate);
    if (!formattedStartDateTime) return undefined;
    const formattedEndDate = this.formatDateTime(medicationStatement.effectivePeriod?.end);
    formattedMedicationStatement.effectivePeriod = {
      start: formattedStartDateTime,
      ...(formattedEndDate ? { end: formattedEndDate } : {}),
    };
    const status = medicationStatement.status;
    if (!status || !medicationStatementStatuses.includes(status)) return undefined;
    formattedMedicationStatement.status = status;
    const dosageText = medicationStatement.dosage?.[0]?.text;
    if (!dosageText) return undefined;
    formattedMedicationStatement.dosage = [{ text: dosageText }];
    return formattedMedicationStatement;
  }

  private formatImmunization(
    immunization: Immunization,
    additionalInfo: Record<string, string | undefined>
  ): Immunization {
    const formattedImmunization: Immunization = {
      resourceType: "Immunization",
      ...(immunization.id ? { id: immunization.id } : {}),
      ...(immunization.patient ? { patient: immunization.patient } : {}),
      ...(immunization.meta ? { meta: immunization.meta } : {}),
      ...(immunization.extension ? { extension: immunization.extension } : {}),
    };
    const cvxCoding = getImmunizationCvxCoding(immunization);
    if (!cvxCoding) {
      throw new BadRequestError("No CVX code found for immunization", undefined, additionalInfo);
    }
    if (!cvxCoding.code) {
      throw new BadRequestError("No code found for CVX coding", undefined, additionalInfo);
    }
    if (!cvxCoding.display) {
      throw new BadRequestError("No display found for CVX coding", undefined, additionalInfo);
    }
    formattedImmunization.vaccineCode = {
      coding: [
        { code: cvxCoding.code, system: "http://hl7.org/fhir/sid/cvx", display: cvxCoding.display },
      ],
    };
    const administerDate = getImmunizationAdministerDate(immunization);
    const formattedAdministerDate = this.formatDate(administerDate);
    if (!formattedAdministerDate) {
      throw new BadRequestError(
        "No administered date found for immunization",
        undefined,
        additionalInfo
      );
    }
    formattedImmunization.occurrenceDateTime = formattedAdministerDate;
    const status = immunization.status;
    if (!status || !immunizationStatuses.includes(status)) {
      throw new BadRequestError("No status found for immunization", undefined, additionalInfo);
    }
    formattedImmunization.status = status;
    formattedImmunization.primarySource = false;
    return formattedImmunization;
  }

  private formatAllergyIntolerance(
    allergyIntolerance: AllergyIntolerance,
    allergenReference: AllergenResource,
    severity: string | undefined,
    additionalInfo: Record<string, string | undefined>
  ): AllergyIntolerance {
    const formattedAllergyIntolerance: AllergyIntolerance = {
      resourceType: "AllergyIntolerance",
      ...(allergyIntolerance.id ? { id: allergyIntolerance.id } : {}),
      ...(allergyIntolerance.patient ? { patient: allergyIntolerance.patient } : {}),
      ...(allergyIntolerance.recorder ? { recorder: allergyIntolerance.recorder } : {}),
      ...(allergyIntolerance.meta ? { meta: allergyIntolerance.meta } : {}),
      ...(allergyIntolerance.extension ? { extension: allergyIntolerance.extension } : {}),
    };
    const fdbCoding = this.getAllergenReferenceFdbCoding(allergenReference);
    if (!fdbCoding) {
      throw new BadRequestError("No FDB code found for allergen", undefined, additionalInfo);
    }
    if (!fdbCoding.code) {
      throw new BadRequestError("No code found for FDB code", undefined, additionalInfo);
    }
    if (!fdbCoding.display) {
      throw new BadRequestError("No display found for FDB code", undefined, additionalInfo);
    }
    formattedAllergyIntolerance.code = {
      coding: [fdbCoding],
      text: fdbCoding.display,
    };
    const onsetDate = getAllergyIntoleranceOnsetDate(allergyIntolerance);
    const formattedOnsetDate = this.formatDate(onsetDate);
    if (!formattedOnsetDate) {
      throw new BadRequestError("No onset date found for allergy", undefined, additionalInfo);
    }
    formattedAllergyIntolerance.onsetDateTime = formattedOnsetDate;
    const clinicalStatus = allergyIntolerance.clinicalStatus;
    if (!clinicalStatus || !clinicalStatus.coding) {
      throw new BadRequestError(
        "No clinical status or codings found for allergy intolerance",
        undefined,
        additionalInfo
      );
    }
    const clinicalStatusCoding = clinicalStatus.coding.filter(coding =>
      allergyIntoleranceClinicalStatuses.includes(coding.code ?? "")
    );
    if (clinicalStatusCoding.length < 1) {
      throw new BadRequestError(
        "No valid clinical status codings found for allergy intolerance",
        undefined,
        additionalInfo
      );
    }
    formattedAllergyIntolerance.clinicalStatus = { coding: clinicalStatusCoding };
    const verificationStatus = allergyIntolerance.verificationStatus;
    if (!verificationStatus || !verificationStatus.coding) {
      throw new BadRequestError(
        "No verification status found for allergy intolerance",
        undefined,
        additionalInfo
      );
    }
    const verificationStatusCoding = verificationStatus.coding.filter(coding =>
      allergyIntoleranceVerificationStatuses.includes(coding.code ?? "")
    );
    if (verificationStatusCoding.length < 1) {
      throw new BadRequestError(
        "No valid verification status codings found for allergy intolerance",
        undefined,
        additionalInfo
      );
    }
    formattedAllergyIntolerance.verificationStatus = { coding: verificationStatusCoding };
    if (severity && allergyIntoleranceSeverityCodes.includes(severity)) {
      formattedAllergyIntolerance.reaction = [
        {
          manifestation: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/data-absent-reason",
                  code: "unknown",
                },
              ],
            },
          ],
          severity: severity as "mild" | "moderate" | "severe",
        },
      ];
    }
    formattedAllergyIntolerance.type = "allergy";
    return formattedAllergyIntolerance;
  }

  private formatVitalDataPoint(
    observation: Observation,
    dataPoint: DataPoint,
    additionalInfo: Record<string, string | undefined>
  ): Observation | undefined {
    const formattedObservation: Observation = {
      resourceType: "Observation",
      ...(observation.id ? { id: observation.id } : {}),
      ...(observation.subject ? { subject: observation.subject } : {}),
      ...(observation.meta ? { meta: observation.meta } : {}),
      ...(observation.extension ? { extension: observation.extension } : {}),
    };
    const loincCoding = getObservationLoincCoding(observation);
    if (!loincCoding) {
      throw new BadRequestError("No LOINC coding found for observation", undefined, additionalInfo);
    }
    if (!loincCoding.code || !vitalSignCodesMap.get(loincCoding.code)) {
      throw new BadRequestError("No valid code found for LOINC coding", undefined, additionalInfo);
    }
    if (!loincCoding.display) {
      throw new BadRequestError("No display found for LOINC coding", undefined, additionalInfo);
    }
    formattedObservation.code = {
      coding: [
        {
          code: [bpDiastolicCode, bpSystolicCode].includes(loincCoding.code)
            ? "85354-9"
            : loincCoding.code,
          system: "http://loinc.org",
          display: [bpDiastolicCode, bpSystolicCode].includes(loincCoding.code)
            ? "Blood pressure"
            : loincCoding.display,
        },
      ],
    };
    const units = getObservationUnit(observation);
    if (!units) {
      throw new BadRequestError("No units found for observation", undefined, additionalInfo);
    }
    const resultStatus = getObservationResultStatus(observation);
    if (!resultStatus || !observationResultStatuses.includes(resultStatus)) {
      throw new BadRequestError("No status found for observation", undefined, additionalInfo);
    }
    formattedObservation.status = resultStatus as ObservationStatus;
    const formattedEffectiveDate = this.formatDateTime(dataPoint.date);
    if (!formattedEffectiveDate) return undefined;
    formattedObservation.effectiveDateTime = formattedEffectiveDate;
    if (dataPoint.bp) {
      formattedObservation.valueString = `${dataPoint.bp.systolic}/${dataPoint.bp.diastolic} mmHg`;
      formattedObservation.component = [
        {
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "8480-6",
                display: "Systolic blood pressure",
              },
            ],
          },
          valueQuantity: {
            value: dataPoint.bp.systolic,
            unit: "mmHg",
            system: "http://unitsofmeasure.org",
            code: "mm[Hg]",
          },
        },
        {
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "8462-4",
                display: "Diastolic blood pressure",
              },
            ],
          },
          valueQuantity: {
            value: dataPoint.bp.diastolic,
            unit: "mmHg",
            system: "http://unitsofmeasure.org",
            code: "mm[Hg]",
          },
        },
      ];
      return formattedObservation;
    }
    const convertedCodeAndValue = convertCodeAndValue(
      loincCoding.code,
      vitalSignCodesMap,
      dataPoint.value,
      units
    );
    if (!convertedCodeAndValue) return undefined;
    formattedObservation.valueQuantity = {
      value: convertedCodeAndValue.value,
      unit: convertedCodeAndValue.units,
    };
    return formattedObservation;
  }

  private getAllergenReferenceFdbCoding(allergenReference: AllergenResource): Coding | undefined {
    const fdbCoding = allergenReference.code.coding?.find((coding: Coding) => {
      const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
      return system?.includes(FDB_CODE);
    });
    return fdbCoding;
  }

  private formatNoteIdExtension(noteId: string): Extension {
    return {
      url: "http://schemas.canvasmedical.com/fhir/extensions/note-id",
      valueId: noteId,
    };
  }

  private sortMedicationStatementsNewestFirst(
    medicationStatements: MedicationStatement[]
  ): MedicationStatement[] {
    return medicationStatements
      .sort((a, b) => {
        const aDate = a.effectivePeriod?.start;
        const bDate = b.effectivePeriod?.start;
        if (!aDate) return -1;
        if (!bDate) return 1;
        const aDateUnix = buildDayjs(aDate).unix();
        const bDateUnix = buildDayjs(bDate).unix();
        if (aDateUnix === bDateUnix) {
          const aEndDate = a.effectivePeriod?.end;
          const bEndDate = b.effectivePeriod?.end;
          if (!aEndDate) return -1;
          if (!bEndDate) return 1;
          const aEndDateUnix = buildDayjs(aEndDate).unix();
          const bEndDateUnix = buildDayjs(bEndDate).unix();
          return aEndDateUnix - bEndDateUnix;
        }
        return aDateUnix - bDateUnix;
      })
      .reverse();
  }

  private createWriteBackPath(resourceType: string, resourceId: string | undefined): string {
    return `fhir/${resourceType}/${resourceId ?? "unknown"}`;
  }

  private createFhirPath(resourceType: string, resourceId?: string): string {
    return `fhir-resources-${resourceType}${resourceId ? `/resourceId/${resourceId}` : ""}`;
  }

  private createReferencePath(referenceType: string, referenceId: string): string {
    return `reference/${referenceType}/${referenceId}`;
  }
}

export default CanvasApi;
