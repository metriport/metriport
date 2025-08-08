import {
  Bundle,
  CodeableConcept,
  Condition,
  DiagnosticReport,
  Observation,
  ResourceType,
} from "@medplum/fhirtypes";
import {
  BadRequestError,
  EhrFhirResourceBundle,
  errorToString,
  JwtTokenInfo,
  MetriportError,
  NotFoundError,
  sleep,
  toTitleCase,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  Appointment,
  AppointmentListResponse,
  appointmentListResponseSchema,
  BookedAppointment,
  bookedAppointmentSchema,
  CcdaDocument,
  ccdaDocumentSchema,
  CreatedLab,
  createdLabSchema,
  CreatedNonVisitNote,
  createdNonVisitNoteSchema,
  CreatedProblem,
  createdProblemSchema,
  CreatedSubscription,
  createdSubscriptionSchema,
  CreatedVital,
  createdVitalSchema,
  elationClientJwtTokenResponseSchema,
  Metadata,
  Patient,
  patientSchema,
  Practice,
  Practices,
  practicesSchema,
  SubscriptionResource,
  Subscriptions,
  subscriptionsSchema,
} from "@metriport/shared/interface/external/ehr/elation/index";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosInstance } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { z } from "zod";
import { base64ToString } from "../../../util/base64";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { uuidv7 } from "../../../util/uuid-v7";
import { GroupedVitalsByDate } from "../command/write-back/grouped-vitals";
import { createOrReplaceDocument } from "../document/command/create-or-replace-document";
import { DocumentType } from "../document/document-shared";
import {
  ApiConfig,
  buildObservationReferenceRange,
  convertEhrBundleToValidEhrStrictBundle,
  createDataParams,
  fetchEhrBundleUsingCache,
  formatDate,
  getConditionSnomedCode,
  getConditionStartDate,
  getConditionStatus,
  getDiagnosticReportDate,
  getObservationInterpretation,
  getObservationLoincCode,
  getObservationLoincCoding,
  getObservationObservedDate,
  getObservationResultStatus,
  getObservationUnit,
  getObservationUnitAndValue,
  getObservationValue,
  makeRequest,
  MakeRequestParamsInEhr,
  paginateWaitTime,
  partitionEhrBundle,
  saveEhrReferenceBundle,
} from "../shared";
import { convertCodeAndValue, formatNumberAsString } from "../unit-conversion";

dayjs.extend(duration);

interface ElationApiConfig extends ApiConfig {
  environment: ElationEnv;
}

const elationDateFormat = "YYYY-MM-DD";
const elationDateTimeFormat = "YYYY-MM-DDTHH:mm:ssZ";
const maxSubscribeAttempts = 3;
const defaultCountOrLimit = 1000;

const elationEnv = ["app", "sandbox"] as const;
export type ElationEnv = (typeof elationEnv)[number];
export function isElationEnv(env: string): env is ElationEnv {
  return elationEnv.includes(env as ElationEnv);
}

const problemStatusesMap = new Map<string, string>();
problemStatusesMap.set("active", "Active");
problemStatusesMap.set("relapse", "Active");
problemStatusesMap.set("recurrence", "Active");
problemStatusesMap.set("remission", "Controlled");
problemStatusesMap.set("resolved", "Resolved");
problemStatusesMap.set("inactive", "Resolved");

type CodeKey = "temperature" | "hr" | "rr" | "oxygen" | "bp" | "weight" | "height" | "wc" | "bmi";

const vitalSignCodesMap = new Map<string, { codeKey: CodeKey; targetUnits: string }>();
vitalSignCodesMap.set("8310-5", { codeKey: "temperature", targetUnits: "degf" });
vitalSignCodesMap.set("8867-4", { codeKey: "hr", targetUnits: "bpm" });
vitalSignCodesMap.set("9279-1", { codeKey: "rr", targetUnits: "bpm" });
vitalSignCodesMap.set("2708-6", { codeKey: "oxygen", targetUnits: "%" });
vitalSignCodesMap.set("59408-5", { codeKey: "oxygen", targetUnits: "%" });
vitalSignCodesMap.set("8462-4", { codeKey: "bp", targetUnits: "mmHg" });
vitalSignCodesMap.set("8480-6", { codeKey: "bp", targetUnits: "mmHg" });
vitalSignCodesMap.set("29463-7", { codeKey: "weight", targetUnits: "lb_av" });
vitalSignCodesMap.set("8302-2", { codeKey: "height", targetUnits: "in_i" });
vitalSignCodesMap.set("56086-2", { codeKey: "wc", targetUnits: "cm" });
vitalSignCodesMap.set("39156-5", { codeKey: "bmi", targetUnits: "kg/m2" });

const bpDiastolicCode = "8462-4";
const bpSystolicCode = "8480-6";

const ccdaSectionMap = new Map<ResourceType, string>();
ccdaSectionMap.set("AllergyIntolerance", "allergies");
ccdaSectionMap.set("Condition", "problems");
ccdaSectionMap.set("DiagnosticReport", "results");
ccdaSectionMap.set("Encounter", "encounters");
ccdaSectionMap.set("Immunization", "immunizations");
ccdaSectionMap.set("MedicationRequest", "medications");
ccdaSectionMap.set("MedicationStatement", "medications");
ccdaSectionMap.set("Observation", "vitals");
ccdaSectionMap.set("Procedure", "procedures");

type ElationLab = {
  report_type: string;
  document_date: string;
  reported_date: string;
  chart_date: string;
  grids: {
    accession_number: string;
    resulted_date: string;
    collected_date: string;
    status: string;
    note: string;
    results: {
      status: string;
      value: string;
      text: string;
      note: string;
      reference_min: string | undefined;
      reference_max: string | undefined;
      units: string;
      is_abnormal: string;
      abnormal_flag: string;
      test: {
        name: string;
        code: string;
        loinc: string;
      };
      test_category: {
        value: string;
        description: string;
      };
    }[];
  }[];
};

type ElationGroupedVitalBase = {
  patient: string;
  practice: string;
  physician: string;
  chart_date: string;
  document_date: string;
};

type ElationGroupedVitalData = {
  [key in CodeKey]?: number | { systolic?: string; diastolic?: string }[] | { value: string }[];
};

type ElationGroupedVital = ElationGroupedVitalBase & ElationGroupedVitalData;

const validLabResultStatuses = [
  "CORRECTED",
  "DELETED",
  "FINAL",
  "PENDING",
  "PRELIMINARY",
  "RESULTS ENTERED -- NOT VERIFIED",
  "PARTIAL",
  "RESULTS STATUS CHANGE TO FINAL. RESULTS DID NOT CHANGE ( DONT TRANSMIT TEST).",
  "RESULT CANCELED DUE TO NON-PERFORMANCE",
  "ERROR",
  "AMENDED",
];

const maxUnitsCharacters = 20;
const maxNameCharacters = 50;

export function isSupportedCcdaSectionResource(resourceType: string): boolean {
  return ccdaSectionMap.has(resourceType as ResourceType);
}

export const supportedElationResources: ResourceType[] = [
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
export const supportedElationReferenceResources: ResourceType[] = [
  "Medication",
  "Location",
  "Organization",
  "Patient",
  "Practitioner",
  "Provenance",
];

export type SupportedElationResource = (typeof supportedElationResources)[number];
export function isSupportedElationResource(
  resourceType: string
): resourceType is SupportedElationResource {
  return supportedElationResources.includes(resourceType as ResourceType);
}

export type SupportedElationReferenceResource = (typeof supportedElationReferenceResources)[number];
export function isSupportedElationReferenceResource(
  resourceType: string
): resourceType is SupportedElationReferenceResource {
  return supportedElationReferenceResources.includes(resourceType as ResourceType);
}

class ElationApi {
  private axiosInstance: AxiosInstance;
  private baseUrl: string;
  private twoLeggedAuthTokenInfo: JwtTokenInfo | undefined;
  private practiceId: string;

  private constructor(private config: ElationApiConfig) {
    this.twoLeggedAuthTokenInfo = config.twoLeggedAuthTokenInfo;
    this.practiceId = config.practiceId;
    this.axiosInstance = axios.create({});
    this.baseUrl = `https://${config.environment}.elationemr.com/api/2.0`;
  }

  public static async create(config: ElationApiConfig): Promise<ElationApi> {
    const instance = new ElationApi(config);
    await instance.initialize();
    return instance;
  }

  getTwoLeggedAuthTokenInfo(): JwtTokenInfo | undefined {
    return this.twoLeggedAuthTokenInfo;
  }

  private async fetchTwoLeggedAuthToken(): Promise<JwtTokenInfo> {
    const url = `${this.baseUrl}/oauth2/token/`;
    const data = {
      grant_type: "client_credentials",
      client_id: this.config.clientKey,
      client_secret: this.config.clientSecret,
    };

    try {
      const response = await axios.post(url, createDataParams(data), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (!response.data) throw new MetriportError("No body returned from token endpoint");
      const tokenData = elationClientJwtTokenResponseSchema.parse(response.data);
      return {
        access_token: tokenData.access_token,
        exp: new Date(Date.now() + +tokenData.expires_in * 1000),
      };
    } catch (error) {
      throw new MetriportError("Failed to fetch Two Legged Auth token @ Elation", undefined, {
        error: errorToString(error),
      });
    }
  }

  async initialize(): Promise<void> {
    const { log } = out(`Elation initialize - practiceId ${this.practiceId}`);
    if (!this.twoLeggedAuthTokenInfo) {
      log(`Two Legged Auth token not found @ Elation - fetching new token`);
      this.twoLeggedAuthTokenInfo = await this.fetchTwoLeggedAuthToken();
    } else if (this.twoLeggedAuthTokenInfo.exp < buildDayjs().add(15, "minutes").toDate()) {
      log(`Two Legged Auth token expired @ Elation - fetching new token`);
      this.twoLeggedAuthTokenInfo = await this.fetchTwoLeggedAuthToken();
    } else {
      log(`Two Legged Auth token found @ Elation - using existing token`);
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.twoLeggedAuthTokenInfo.access_token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }

  async getPatient({ cxId, patientId }: { cxId: string; patientId: string }): Promise<Patient> {
    const { debug } = out(
      `Elation getPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientUrl = `/patients/${patientId}/`;
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
    });
    return patient;
  }

  async getPractices(cxId: string): Promise<Practice[]> {
    const { debug } = out(`Elation getPractices - cxId ${cxId} practiceId ${this.practiceId}`);
    const practicesUrl = `/practices/`;
    const practices = await this.makeRequest<Practices>({
      cxId,
      s3Path: "practices",
      method: "GET",
      url: practicesUrl,
      schema: practicesSchema,
      additionalInfo: { cxId, practiceId: this.practiceId },
      debug,
    });
    return practices.results.filter(practice => practice.status === "active");
  }

  async getCcdaDocument({
    cxId,
    patientId,
    resourceType,
  }: {
    cxId: string;
    patientId: string;
    resourceType?: string;
  }): Promise<string> {
    const { debug } = out(
      `Elation getCcdaDocument - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} resourceType ${resourceType}`
    );
    if (resourceType && !isSupportedCcdaSectionResource(resourceType)) {
      throw new BadRequestError("Invalid resource type", undefined, {
        resourceType,
      });
    }
    const sections = resourceType ? ccdaSectionMap.get(resourceType as ResourceType) : undefined;
    const params = new URLSearchParams({ ...(sections && { sections }) });
    const ccdaDocumentUrl = `/ccda/${patientId}/?${params.toString()}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId, resourceType };
    const s3PathResourceType = resourceType ?? "all";
    const document = await this.makeRequest<CcdaDocument>({
      cxId,
      patientId,
      s3Path: `ccda-document/${s3PathResourceType}`,
      method: "GET",
      url: ccdaDocumentUrl,
      schema: ccdaDocumentSchema,
      additionalInfo,
      debug,
    });
    return base64ToString(document.base64_ccda);
  }

  async updatePatientMetadata({
    cxId,
    patientId,
    metadata,
  }: {
    cxId: string;
    patientId: string;
    metadata: Metadata;
  }): Promise<Patient> {
    const { debug } = out(
      `Elation updatePatientMetadata - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientUrl = `/patients/${patientId}/`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const patient = await this.makeRequest<Patient>({
      cxId,
      patientId,
      s3Path: "patient-update-metadata",
      method: "PATCH",
      url: patientUrl,
      data: { metadata },
      headers: { "Content-Type": "application/json" },
      schema: patientSchema,
      additionalInfo,
      debug,
    });
    return patient;
  }

  async createNonVisitNote({
    cxId,
    patientId,
    date,
    note,
  }: {
    cxId: string;
    patientId: string;
    date: string;
    note: string;
  }): Promise<CreatedNonVisitNote> {
    const { debug } = out(
      `Elation createNonVisitNote - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientUrl = `/non_visit_notes/`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const data = {
      bullets: [{ text: note }],
      patient: patientId,
      chart_date: this.formatDateTime(date),
      document_date: this.formatDateTime(date),
      type: "nonvisit",
    };
    const nonVisitNote = await this.makeRequest<CreatedNonVisitNote>({
      cxId,
      patientId,
      s3Path: "non-visit-note",
      method: "POST",
      url: patientUrl,
      data,
      headers: { "Content-Type": "application/json" },
      schema: createdNonVisitNoteSchema,
      additionalInfo,
      debug,
    });
    return nonVisitNote;
  }

  async createProblem({
    cxId,
    patientId,
    condition,
  }: {
    cxId: string;
    patientId: string;
    condition: Condition;
  }): Promise<CreatedProblem> {
    const { debug } = out(
      `Elation createProblem - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const problemUrl = `/problems/`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      conditionId: condition.id,
    };
    const snomedCode = getConditionSnomedCode(condition);
    if (!snomedCode) {
      throw new BadRequestError("No SNOMED code found for condition", undefined, additionalInfo);
    }
    const startDate = getConditionStartDate(condition);
    if (!startDate) {
      throw new BadRequestError("No start date found for condition", undefined, additionalInfo);
    }
    const conditionStatus = getConditionStatus(condition);
    const problemStatus = conditionStatus
      ? problemStatusesMap.get(conditionStatus.toLowerCase())
      : undefined;
    if (!problemStatus) {
      throw new BadRequestError("No problem status found for condition", undefined, additionalInfo);
    }
    const data = {
      patient: patientId,
      status: problemStatus,
      dx: [{ snomed: snomedCode }],
      start_date: this.formatDate(startDate),
      description: condition.code?.text,
    };
    const problem = await this.makeRequest<CreatedProblem>({
      cxId,
      patientId,
      s3Path: this.createWriteBackPath("problem", condition.id),
      method: "POST",
      url: problemUrl,
      data,
      schema: createdProblemSchema,
      additionalInfo,
      headers: { "Content-Type": "application/json" },
      debug,
    });
    return problem;
  }

  async createLabPanel({
    cxId,
    elationPracticeId,
    elationPhysicianId,
    patientId,
    diagnosticReport,
    observations,
  }: {
    cxId: string;
    elationPracticeId: string;
    elationPhysicianId: string;
    patientId: string;
    diagnosticReport: DiagnosticReport;
    observations: Observation[];
  }): Promise<CreatedLab> {
    const { debug } = out(
      `Elation createLab - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const reportsUrl = `/reports/`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      diagnostricReportId: diagnosticReport.id,
    };
    const data = {
      patient: patientId,
      practice: elationPracticeId,
      physician: elationPhysicianId,
      custom_title: this.getMostInformativeTitle(diagnosticReport.code),
      ...this.formatLabPanel(diagnosticReport, observations, additionalInfo),
    };
    const lab = await this.makeRequest<CreatedLab>({
      cxId,
      patientId,
      s3Path: this.createWriteBackPath("lab-panel", diagnosticReport.id),
      method: "POST",
      url: reportsUrl,
      data,
      schema: createdLabSchema,
      additionalInfo,
      headers: { "Content-Type": "application/json" },
      debug,
    });
    return lab;
  }

  async createLab({
    cxId,
    elationPracticeId,
    elationPhysicianId,
    patientId,
    observation,
  }: {
    cxId: string;
    elationPracticeId: string;
    elationPhysicianId: string;
    patientId: string;
    observation: Observation;
  }): Promise<CreatedLab | undefined> {
    const { debug } = out(
      `Elation createLab - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const reportsUrl = `/reports/`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      observationId: observation.id,
    };
    const data = {
      patient: patientId,
      practice: elationPracticeId,
      physician: elationPhysicianId,
      ...this.formatLab(observation, additionalInfo),
    };
    const lab = await this.makeRequest<CreatedLab>({
      cxId,
      patientId,
      s3Path: this.createWriteBackPath("lab", observation.id),
      method: "POST",
      url: reportsUrl,
      data,
      schema: createdLabSchema,
      additionalInfo,
      headers: { "Content-Type": "application/json" },
      debug,
    });
    return lab;
  }

  async createGroupedVitals({
    cxId,
    elationPracticeId,
    elationPhysicianId,
    patientId,
    groupedVitals,
  }: {
    cxId: string;
    elationPracticeId: string;
    elationPhysicianId: string;
    patientId: string;
    groupedVitals: GroupedVitalsByDate;
  }): Promise<CreatedVital | undefined> {
    const { log, debug } = out(
      `Elation createGroupedVitals - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const vitalsUrl = `/vitals/`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
    };
    const [chartDate, observations] = groupedVitals;
    const vitals = observations.flatMap(observation => {
      const formattedVital = this.formatGroupedVital(observation);
      if (!formattedVital) return [];
      return formattedVital;
    });
    if (vitals.length < 1) {
      throw new BadRequestError("No grouped vitals data found", undefined, additionalInfo);
    }
    const baseData = {
      patient: patientId,
      practice: elationPracticeId,
      physician: elationPhysicianId,
      chart_date: this.formatDateTime(chartDate.toISOString()),
      document_date: this.formatDateTime(chartDate.toISOString()),
    } as ElationGroupedVital;
    const data = vitals.reduce((existingVital, newVital) => {
      if (existingVital.bp && newVital.bp) {
        const existingBp = existingVital.bp as { systolic?: string; diastolic?: string }[];
        const newBp = newVital.bp as { systolic?: string; diastolic?: string }[];
        existingVital.bp = [
          {
            ...existingBp[0],
            ...newBp[0],
          },
        ];
      } else {
        existingVital = {
          ...existingVital,
          ...newVital,
        } as ElationGroupedVital;
      }
      return existingVital;
    }, baseData);
    try {
      const nonVisitNote = await this.createNonVisitNote({
        cxId,
        patientId,
        date: chartDate.toISOString(),
        note: "Vitals added via Metriport App",
      });
      const createdVital = await this.makeRequest<CreatedVital>({
        cxId,
        patientId,
        s3Path: this.createWriteBackPath("grouped-vitals", undefined),
        method: "POST",
        url: vitalsUrl,
        data: {
          ...data,
          non_visit_note: nonVisitNote.id,
        },
        schema: createdVitalSchema,
        additionalInfo,
        headers: { "Content-Type": "application/json" },
        debug,
      });

      return createdVital;
    } catch (error) {
      if (error instanceof BadRequestError || error instanceof NotFoundError) return;
      const msg = `Failure while creating grouped vitals @ Elation`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.message(msg, {
        extra: {
          ...additionalInfo,
          error,
          patientId,
          cxId,
          context: "elation.create-grouped-vitals",
        },
        level: "warning",
      });
    }

    return undefined;
  }

  async getBundleByResourceType({
    cxId,
    metriportPatientId,
    elationPatientId,
    resourceType,
    fhirConverterToEhrBundle,
    useCachedBundle = true,
  }: {
    cxId: string;
    metriportPatientId: string;
    elationPatientId: string;
    resourceType: string;
    fhirConverterToEhrBundle: (params: {
      inputS3Key: string;
      inputS3BucketName: string;
    }) => Promise<EhrFhirResourceBundle>;
    useCachedBundle?: boolean;
  }): Promise<Bundle> {
    if (!isSupportedElationResource(resourceType)) {
      throw new BadRequestError("Invalid resource type", undefined, {
        resourceType,
      });
    }
    const ccda = await this.getCcdaDocument({
      cxId,
      patientId: elationPatientId,
      resourceType,
    });
    const { s3key, s3BucketName } = await createOrReplaceDocument({
      ehr: EhrSources.elation,
      cxId,
      metriportPatientId,
      ehrPatientId: elationPatientId,
      documentType: DocumentType.CCDA,
      payload: ccda,
      resourceType,
    });
    let referenceEhrFhirBundle: EhrFhirResourceBundle | undefined;
    async function fetchResourcesFromEhr() {
      const bundle = await fhirConverterToEhrBundle({
        inputS3Key: s3key,
        inputS3BucketName: s3BucketName,
      });
      const { targetBundle, referenceBundle } = partitionEhrBundle({
        bundle,
        resourceType,
      });
      referenceEhrFhirBundle = referenceBundle;
      const strictTargetBundle = convertEhrBundleToValidEhrStrictBundle(
        targetBundle,
        resourceType,
        metriportPatientId
      );
      return [...(strictTargetBundle.entry?.map(e => e.resource) ?? [])];
    }
    const bundle = await fetchEhrBundleUsingCache({
      ehr: EhrSources.elation,
      cxId,
      metriportPatientId,
      ehrPatientId: elationPatientId,
      resourceType,
      fetchResourcesFromEhr,
      useCachedBundle,
    });
    if (referenceEhrFhirBundle) {
      await saveEhrReferenceBundle({
        ehr: EhrSources.elation,
        cxId,
        metriportPatientId,
        ehrPatientId: elationPatientId,
        referenceBundle: referenceEhrFhirBundle,
      });
    }
    return bundle;
  }

  async getResourceBundleByResourceId({
    cxId,
    metriportPatientId,
    elationPatientId,
    resourceType,
    resourceId,
  }: {
    cxId: string;
    metriportPatientId: string;
    elationPatientId: string;
    resourceType: string;
    resourceId: string;
  }): Promise<Bundle> {
    if (
      !isSupportedElationResource(resourceType) &&
      !isSupportedElationReferenceResource(resourceType)
    ) {
      throw new BadRequestError("Invalid resource type", undefined, {
        elationPatientId,
        resourceId,
        resourceType,
      });
    }
    const bundle = await fetchEhrBundleUsingCache({
      ehr: EhrSources.elation,
      cxId,
      metriportPatientId,
      ehrPatientId: elationPatientId,
      resourceType,
      resourceId,
      fetchResourcesFromEhr: () => Promise.resolve([]),
      useCachedBundle: true,
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
  }): Promise<BookedAppointment[]> {
    const { debug } = out(`Elation getAppointments - cxId ${cxId} practiceId ${this.practiceId}`);
    const params = {
      from_date: this.formatDate(fromDate.toISOString()) ?? "",
      to_date: this.formatDate(toDate.toISOString()) ?? "",
      limit: defaultCountOrLimit.toString(),
    };
    const urlParams = new URLSearchParams(params);
    const appointmentUrl = `/appointments/?${urlParams.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
    };
    async function paginateAppointments(
      api: ElationApi,
      url: string | null,
      acc: Appointment[] | undefined = []
    ): Promise<Appointment[]> {
      if (!url) return acc;
      await sleep(paginateWaitTime.asMilliseconds());
      const appointmentListResponse = await api.makeRequest<AppointmentListResponse>({
        cxId,
        s3Path: "appointments",
        method: "GET",
        url: url.replace(api.baseUrl, ""),
        schema: appointmentListResponseSchema,
        additionalInfo,
        debug,
      });
      acc.push(...appointmentListResponse.results);
      return paginateAppointments(api, appointmentListResponse.next, acc);
    }
    const appointments = await paginateAppointments(this, appointmentUrl);
    const bookedAppointments = appointments
      .filter(
        app => app.patient !== null && app.status !== null && app.status.status === "Scheduled"
      )
      .map(a => bookedAppointmentSchema.parse(a));
    return bookedAppointments;
  }

  async replaceSubscription({
    cxId,
    resource,
  }: {
    cxId: string;
    resource: SubscriptionResource;
  }): Promise<void> {
    const { debug } = out(
      `Elation replaceSubscription - cxId ${cxId} practiceId ${this.practiceId} resource ${resource}`
    );
    const getSubscriptionsUrl = "/app/subscriptions/";
    const additionalInfo = { cxId, practiceId: this.practiceId };
    const subscriptions = await this.makeRequest<Subscriptions>({
      cxId,
      s3Path: `${resource}-replace-subscription-get`,
      method: "GET",
      url: getSubscriptionsUrl,
      schema: subscriptionsSchema,
      additionalInfo,
      debug,
    });
    const subscription = subscriptions.results.find(s => s.resource === resource);
    if (!subscription) {
      throw new NotFoundError("Subscription not found @ Elation", undefined, {
        resource,
        cxId,
        practiceId: this.practiceId,
      });
    }
    const deleteSubscriptionUrl = `/app/subscriptions/${subscription.id}/`;
    await this.makeRequest<undefined>({
      cxId,
      s3Path: `${resource}-replace-subscription-delete`,
      method: "DELETE",
      url: deleteSubscriptionUrl,
      schema: z.undefined(),
      additionalInfo,
      debug,
      emptyResponse: true,
    });
  }

  async subscribeToResource({
    cxId,
    resource,
    attempt = 1,
  }: {
    cxId: string;
    resource: SubscriptionResource;
    attempt?: number;
  }): Promise<CreatedSubscription> {
    const { log, debug } = out(
      `Elation subscribeToResource - cxId ${cxId} practiceId ${this.practiceId} resource ${resource} attempt ${attempt}`
    );
    if (attempt > maxSubscribeAttempts) {
      throw new MetriportError("Max attempts reached for subscribing to resource", undefined, {
        cxId,
        practiceId: this.practiceId,
        resource,
        attempt,
      });
    }
    const subscriptionUrl = "/app/subscriptions/";
    const additionalInfo = { cxId, practiceId: this.practiceId };
    const apiUrl = Config.getApiUrl();
    const data = {
      resource,
      target: `${apiUrl}/ehr/webhook/elation`,
    };
    try {
      const subscription = await this.makeRequest<CreatedSubscription>({
        cxId,
        s3Path: `${resource}-subscribe`,
        method: "POST",
        url: subscriptionUrl,
        data,
        schema: createdSubscriptionSchema,
        additionalInfo,
        debug,
      });
      return subscription;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.message?.includes("Duplicated object")) {
        log(`Subscription already exists for ${resource} and cxId ${cxId} @ Elation - deleting`);
        await this.replaceSubscription({ cxId, resource });
        return await this.subscribeToResource({ cxId, resource, attempt: attempt + 1 });
      }
      throw error;
    }
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
    earlyReturn = false,
  }: MakeRequestParamsInEhr<T>): Promise<T> {
    return await makeRequest<T>({
      ehr: EhrSources.elation,
      cxId,
      practiceId: this.practiceId,
      patientId,
      s3Path,
      axiosInstance: this.axiosInstance,
      url,
      method,
      data,
      headers,
      schema,
      additionalInfo,
      debug,
      emptyResponse,
      earlyReturn,
    });
  }

  private formatDate(date: string | undefined): string | undefined {
    return formatDate(date, elationDateFormat);
  }

  private formatDateTime(date: string | undefined): string | undefined {
    return formatDate(date, elationDateTimeFormat);
  }

  private formatLab(
    observation: Observation,
    additionalInfo: Record<string, string | undefined>
  ): ElationLab {
    const loincCoding = getObservationLoincCoding(observation);
    if (!loincCoding) {
      throw new BadRequestError("No LOINC coding found for observation", undefined, additionalInfo);
    }
    if (!loincCoding.code) {
      throw new BadRequestError("No valid code found for LOINC coding", undefined, additionalInfo);
    }
    if (!loincCoding.display) {
      throw new BadRequestError("No display found for LOINC coding", undefined, additionalInfo);
    }
    const unitAndValue = getObservationUnitAndValue(observation);
    if (!unitAndValue) {
      throw new BadRequestError(
        "No unit and value found for observation",
        undefined,
        additionalInfo
      );
    }
    const [unit, value] = unitAndValue;
    const referenceRange = buildObservationReferenceRange(observation);
    if (!referenceRange || (!referenceRange.low && !referenceRange.high)) {
      throw new BadRequestError(
        "No reference range found for observation",
        undefined,
        additionalInfo
      );
    }
    const resultStatus = getObservationResultStatus(observation);
    if (!resultStatus) {
      throw new BadRequestError(
        "No result status found for observation",
        undefined,
        additionalInfo
      );
    }
    const formattedResultStatus = resultStatus.toUpperCase();
    if (!validLabResultStatuses.includes(formattedResultStatus)) {
      throw new BadRequestError("Invalid result status", undefined, {
        ...additionalInfo,
        resultStatus: formattedResultStatus,
      });
    }
    const observedDate = getObservationObservedDate(observation);
    const formattedObservedDate = this.formatDateTime(observedDate);
    if (!formattedObservedDate) {
      throw new BadRequestError(
        "No observed date found for observation",
        undefined,
        additionalInfo
      );
    }
    const interpretation = getObservationInterpretation(observation, value);
    if (!interpretation) {
      throw new BadRequestError(
        "No interpretation found for observation",
        undefined,
        additionalInfo
      );
    }
    const isAbnormal = interpretation === "abnormal";
    const text = observation.text?.div;
    const normalizedText = (
      text ? this.normalizeLabTitle(text) : this.normalizeLabTitle(loincCoding.display)
    ).slice(0, maxNameCharacters);
    return {
      report_type: "Lab",
      document_date: formattedObservedDate,
      reported_date: formattedObservedDate,
      chart_date: formattedObservedDate,
      grids: [
        {
          accession_number: uuidv7(),
          resulted_date: formattedObservedDate,
          collected_date: formattedObservedDate,
          status: formattedResultStatus,
          note: "Added via Metriport App",
          results: [
            {
              status: formattedResultStatus,
              value: value.toString(),
              text: "",
              note: "",
              reference_min: referenceRange.low?.toString() ?? "",
              reference_max: referenceRange.high?.toString() ?? "",
              units: unit.slice(0, maxUnitsCharacters),
              is_abnormal: isAbnormal ? "1" : "0",
              abnormal_flag: this.mapInterpretationToAbnormalFlag(interpretation),
              test: {
                name: normalizedText,
                code: loincCoding.code,
                loinc: loincCoding.code,
              },
              test_category: {
                value: loincCoding.display.slice(0, maxNameCharacters),
                description: loincCoding.display.slice(0, maxNameCharacters),
              },
            },
          ],
        },
      ],
    };
  }

  private getMostInformativeTitle(code: CodeableConcept | undefined): string | undefined {
    const coding = code?.coding;
    if (!coding?.length) return this.normalizeTitle(code?.text);

    const mostRelevantSystem = coding[0]?.system;
    if (!mostRelevantSystem) return this.normalizeTitle(code?.text);

    const mostRelevantCodings = coding.filter(c => c.system === mostRelevantSystem && c.display);
    if (mostRelevantCodings.length === 0) return this.normalizeTitle(code?.text);

    const rankedCodings = mostRelevantCodings.flatMap(coding => {
      if (!coding.display) return [];

      const display = coding.display.toLowerCase().trim();

      let score = 9;
      if (display.includes("unknown") || display === "unk") {
        score = 0;
      } else if (display === "laboratory") {
        score = 1;
      } else if (display.includes("specimen") || display.includes("chemistry")) {
        score = 2;
      }

      return { display: coding.display, score };
    });

    const best = rankedCodings.sort((a, b) =>
      b.score !== a.score ? b.score - a.score : b.display.length - a.display.length
    )[0];

    return this.normalizeTitle(best?.display) ?? this.normalizeTitle(code?.text);
  }

  private normalizeLabTitle(title: string): string {
    return title.trim().slice(0, maxNameCharacters);
  }

  private normalizeTitle(title: string | undefined): string | undefined {
    if (!title) return undefined;
    return toTitleCase(this.normalizeLabTitle(title));
  }

  private formatLabPanel(
    diagnosticReport: DiagnosticReport,
    observations: Observation[],
    additionalInfo: Record<string, string | undefined>
  ): ElationLab {
    const reportDate = getDiagnosticReportDate(diagnosticReport);
    const formattedReportDate = this.formatDateTime(reportDate);
    if (!formattedReportDate) {
      throw new BadRequestError(
        "No report date found for diagnostic report",
        undefined,
        additionalInfo
      );
    }

    const diagReportTitle = this.getMostInformativeTitle(diagnosticReport.code);
    if (!diagReportTitle) {
      throw new BadRequestError("No title found for diagnostic report", undefined, additionalInfo);
    }

    const observationResults = observations.flatMap(observation => {
      const loincCoding = getObservationLoincCoding(observation);
      if (!loincCoding) return [];
      if (!loincCoding.code) return [];
      if (!loincCoding.display) return [];
      const unitAndValue = getObservationUnitAndValue(observation);
      if (!unitAndValue) return [];
      const [unit, value] = unitAndValue;
      const referenceRange = buildObservationReferenceRange(observation);
      if (!referenceRange || (!referenceRange.low && !referenceRange.high)) {
        return [];
      }
      const resultStatus = getObservationResultStatus(observation);
      if (!resultStatus || resultStatus.trim().toLowerCase() != "final") {
        return [];
      }
      const formattedResultStatus = resultStatus.toUpperCase();
      if (!validLabResultStatuses.includes(formattedResultStatus)) {
        return [];
      }
      const observedDate = getObservationObservedDate(observation);
      const formattedObservedDate = this.formatDateTime(observedDate);
      if (!formattedObservedDate) {
        return [];
      }
      const interpretation = getObservationInterpretation(observation, value);
      if (!interpretation) {
        return [];
      }
      const isAbnormal = interpretation === "abnormal";
      const text = observation.text?.div;
      const normalizedText = (
        text ? this.normalizeLabTitle(text) : this.normalizeLabTitle(loincCoding.display)
      ).slice(0, maxNameCharacters);

      return {
        status: formattedResultStatus,
        value: value.toString(),
        text: "",
        note: "",
        reference_min: referenceRange.low?.toString() ?? "",
        reference_max: referenceRange.high?.toString() ?? "",
        units: unit.slice(0, maxUnitsCharacters),
        is_abnormal: isAbnormal ? "1" : "0",
        abnormal_flag: this.mapInterpretationToAbnormalFlag(interpretation),
        test: {
          name: normalizedText,
          code: loincCoding.code,
          loinc: loincCoding.code,
        },
        test_category: {
          value: formattedReportDate,
          description: diagReportTitle,
        },
      };
    });

    if (observationResults.length < 1) {
      throw new BadRequestError(
        "No valid observations found for lab panel",
        undefined,
        additionalInfo
      );
    }

    const grids: ElationLab["grids"] = [
      {
        accession_number: uuidv7(),
        resulted_date: formattedReportDate,
        collected_date: formattedReportDate,
        status: "FINAL",
        note: "Added via Metriport App",
        results: observationResults,
      },
    ];

    return {
      report_type: "Lab",
      document_date: formattedReportDate,
      reported_date: formattedReportDate,
      chart_date: formattedReportDate,
      grids,
    };
  }

  private formatGroupedVital(observation: Observation): ElationGroupedVitalData | undefined {
    const loincCode = getObservationLoincCode(observation);
    if (!loincCode || !vitalSignCodesMap.get(loincCode)) return undefined;
    const units = getObservationUnit(observation);
    if (!units) return undefined;
    const value = getObservationValue(observation);
    if (!value) return undefined;
    const chartDate = getObservationObservedDate(observation);
    const formattedChartDate = this.formatDate(chartDate);
    if (!formattedChartDate) return undefined;
    const convertedCodeAndValue = convertCodeAndValue(loincCode, vitalSignCodesMap, value, units);
    if (!convertedCodeAndValue) return undefined;
    if (convertedCodeAndValue.codeKey === "bmi") {
      return {
        bmi: +formatNumberAsString(convertedCodeAndValue.value),
      };
    }
    if (convertedCodeAndValue.codeKey === "bp") {
      if (loincCode === bpDiastolicCode) {
        return {
          bp: [
            {
              diastolic: formatNumberAsString(convertedCodeAndValue.value),
            },
          ],
        };
      }
      if (loincCode === bpSystolicCode) {
        return {
          bp: [
            {
              systolic: formatNumberAsString(convertedCodeAndValue.value),
            },
          ],
        };
      }
    }
    return {
      [convertedCodeAndValue.codeKey]: [
        {
          value: formatNumberAsString(convertedCodeAndValue.value),
        },
      ],
    };
  }

  private mapInterpretationToAbnormalFlag(interpretation: string): string {
    if (interpretation === "abnormal") return "Abnormal";
    if (interpretation === "normal") return "Intermediate result";
    if (interpretation === "low") return "Below low normal";
    if (interpretation === "high") return "Above high normal";
    return "Not Applicable";
  }

  private createWriteBackPath(resourceType: string, resourceId: string | undefined): string {
    return `write-back/${resourceType}/${resourceId ?? "unknown"}`;
  }
}

export default ElationApi;
