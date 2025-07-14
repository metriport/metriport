import { Bundle, Condition, DiagnosticReport, Observation, ResourceType } from "@medplum/fhirtypes";
import {
  BadRequestError,
  EhrFhirResourceBundle,
  errorToString,
  JwtTokenInfo,
  MetriportError,
  NotFoundError,
  sleep,
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
import { z } from "zod";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { createOrReplaceCcda } from "../bundle/command/create-or-replace-ccda";
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
  getDiagnosticReportResultStatus,
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

const vitalSignCodesMap = new Map<string, { codeKey: string; units: string }>();
vitalSignCodesMap.set("8310-5", { codeKey: "temperature", units: "degf" });
vitalSignCodesMap.set("8867-4", { codeKey: "hr", units: "bpm" });
vitalSignCodesMap.set("9279-1", { codeKey: "rr", units: "bpm" });
vitalSignCodesMap.set("2708-6", { codeKey: "oxygen", units: "%" });
vitalSignCodesMap.set("59408-5", { codeKey: "oxygen", units: "%" });
vitalSignCodesMap.set("8462-4", { codeKey: "bp", units: "mmHg" });
vitalSignCodesMap.set("8480-6", { codeKey: "bp", units: "mmHg" });
vitalSignCodesMap.set("85354-9", { codeKey: "bp", units: "mmHg" });
vitalSignCodesMap.set("29463-7", { codeKey: "weight", units: "lb_av" });
vitalSignCodesMap.set("8302-2", { codeKey: "height", units: "in_i" });
vitalSignCodesMap.set("56086-2", { codeKey: "wc", units: "cm" });
vitalSignCodesMap.set("39156-5", { codeKey: "bmi", units: "kg/m2" });

const bpGlobalCode = "85354-9";
const bpSystolicCode = "8480-6";
const bpDiastolicCode = "8462-4";

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

const gToLbs = 0.00220462;
const kgToLbs = 2.20462;
const cmToInches = 0.393701;
const inchesToCm = 2.54;

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
    return atob(document.base64_ccda);
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
    diagnostricReport,
    observations,
  }: {
    cxId: string;
    elationPracticeId: string;
    elationPhysicianId: string;
    patientId: string;
    diagnostricReport: DiagnosticReport;
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
      diagnostricReportId: diagnostricReport.id,
    };
    const data = {
      patient: patientId,
      practice: elationPracticeId,
      physician: elationPhysicianId,
      ...this.formatLabPanel(diagnostricReport, observations, additionalInfo),
    };
    const lab = await this.makeRequest<CreatedLab>({
      cxId,
      patientId,
      s3Path: this.createWriteBackPath("lab-panel", diagnostricReport.id),
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

  async createVital({
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
  }): Promise<CreatedVital> {
    const { debug } = out(
      `Elation createVital - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const vitalsUrl = `/vitals/`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      observationId: observation.id,
    };
    const { chart_date, data: vitalData } = this.formatVital(observation, additionalInfo);
    const data = {
      patient: patientId,
      practice: elationPracticeId,
      physician: elationPhysicianId,
      chart_date,
      ...vitalData,
    };
    const vital = await this.makeRequest<CreatedVital>({
      cxId,
      patientId,
      s3Path: this.createWriteBackPath("vital", observation.id),
      method: "POST",
      url: vitalsUrl,
      data,
      schema: createdVitalSchema,
      additionalInfo,
      headers: { "Content-Type": "application/json" },
      debug,
    });
    return vital;
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
    const payload = await this.getCcdaDocument({
      cxId,
      patientId: elationPatientId,
      resourceType,
    });
    const { s3key, s3BucketName } = await createOrReplaceCcda({
      ehr: EhrSources.elation,
      cxId,
      metriportPatientId,
      ehrPatientId: elationPatientId,
      payload,
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
    const formattedChartDate = this.formatDateTime(buildDayjs().toISOString());
    if (!formattedChartDate) {
      throw new BadRequestError("No chart date found for observation", undefined, additionalInfo);
    }
    const text = observation.text?.div;
    return {
      report_type: "Lab",
      document_date: formattedObservedDate,
      reported_date: formattedObservedDate,
      chart_date: formattedChartDate,
      grids: [
        {
          accession_number: "",
          resulted_date: formattedObservedDate,
          collected_date: formattedObservedDate,
          status: formattedResultStatus,
          note: "Added via Metriport App",
          results: [
            {
              status: formattedResultStatus,
              value: value.toString(),
              text: text ?? loincCoding.display,
              note: "Added via Metriport App",
              reference_min: referenceRange.low?.toString(),
              reference_max: referenceRange.high?.toString(),
              units: unit.slice(0, maxUnitsCharacters),
              is_abnormal: isAbnormal ? "1" : "0",
              abnormal_flag: this.mapInterpretationToAbnormalFlag(interpretation),
              test: {
                name: loincCoding.display,
                code: loincCoding.code,
                loinc: loincCoding.code,
              },
              test_category: {
                value: loincCoding.display,
                description: loincCoding.display,
              },
            },
          ],
        },
      ],
    };
  }

  private formatLabPanel(
    diagnostricReport: DiagnosticReport,
    observations: Observation[],
    additionalInfo: Record<string, string | undefined>
  ): ElationLab {
    const resultStatus = getDiagnosticReportResultStatus(diagnostricReport);
    if (!resultStatus) {
      throw new BadRequestError(
        "No result status found for diagnostic report",
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
    const reportDate = getDiagnosticReportDate(diagnostricReport);
    const formattedReportDate = this.formatDateTime(reportDate);
    if (!formattedReportDate) {
      throw new BadRequestError(
        "No report date found for diagnostic report",
        undefined,
        additionalInfo
      );
    }
    const formattedChartDate = this.formatDateTime(buildDayjs().toISOString());
    if (!formattedChartDate) {
      throw new BadRequestError("No chart date found for observation", undefined, additionalInfo);
    }
    const results: ElationLab["grids"][0]["results"] = observations.flatMap(observation => {
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
      if (!resultStatus) {
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
      return {
        status: formattedResultStatus,
        value: value.toString(),
        text: text ?? loincCoding.display,
        note: "Added via Metriport App",
        reference_min: referenceRange.low?.toString(),
        reference_max: referenceRange.high?.toString(),
        units: unit.slice(0, maxUnitsCharacters),
        is_abnormal: isAbnormal ? "1" : "0",
        abnormal_flag: this.mapInterpretationToAbnormalFlag(interpretation),
        test: {
          name: loincCoding.display,
          code: loincCoding.code,
          loinc: loincCoding.code,
        },
        test_category: {
          value: loincCoding.display,
          description: loincCoding.display,
        },
      };
    });
    if (results.length < 1) {
      throw new BadRequestError(
        "No results found for diagnostic report",
        undefined,
        additionalInfo
      );
    }
    return {
      report_type: "Lab",
      document_date: formattedReportDate,
      reported_date: formattedReportDate,
      chart_date: formattedChartDate,
      grids: [
        {
          accession_number: "",
          resulted_date: formattedReportDate,
          collected_date: formattedReportDate,
          status: formattedResultStatus,
          note: "Added via Metriport App",
          results,
        },
      ],
    };
  }

  private formatVital(
    observation: Observation,
    additionalInfo: Record<string, string | undefined>
  ):
    | { chart_date: string; data: { [key: string]: { value: string }[] } }
    | { chart_date: string; data: { bmi: number } }
    | {
        chart_date: string;
        data: { bp: { systolic: string | undefined; diastolic: string | undefined }[] };
      } {
    const loincCode = getObservationLoincCode(observation);
    if (!loincCode || !vitalSignCodesMap.get(loincCode)) {
      throw new BadRequestError("No LOINC code found for observation", undefined, additionalInfo);
    }
    const units = getObservationUnit(observation);
    if (!units) {
      throw new BadRequestError("No units found for observation", undefined, additionalInfo);
    }
    const value = getObservationValue(observation);
    if (!value) {
      throw new BadRequestError("No value found for observation", undefined, additionalInfo);
    }
    const chartDate = getObservationObservedDate(observation);
    const formattedChartDate = this.formatDateTime(chartDate);
    if (!formattedChartDate) {
      throw new BadRequestError(
        "No observed date found for observation",
        undefined,
        additionalInfo
      );
    }
    const convertedCodeAndValue = this.convertCodeAndValue(loincCode, value, units);
    if (!convertedCodeAndValue) {
      throw new BadRequestError("No value converted for observation", undefined, additionalInfo);
    }
    if (convertedCodeAndValue.codeKey === "bmi") {
      return {
        chart_date: formattedChartDate,
        data: {
          bmi: +convertedCodeAndValue.value,
        },
      };
    }
    if (convertedCodeAndValue.codeKey === "bp") {
      if (loincCode === bpGlobalCode) {
        const [systolic, diastolic] = convertedCodeAndValue.value
          .toString()
          .replace("mmHg", "")
          .split("/");
        return {
          chart_date: formattedChartDate,
          data: {
            bp: [
              {
                systolic: systolic ? systolic.trim() : undefined,
                diastolic: diastolic ? diastolic.trim() : undefined,
              },
            ],
          },
        };
      } else if (loincCode === bpSystolicCode) {
        return {
          chart_date: formattedChartDate,
          data: {
            bp: [
              {
                systolic: convertedCodeAndValue.value.toString(),
                diastolic: undefined,
              },
            ],
          },
        };
      } else if (loincCode === bpDiastolicCode) {
        return {
          chart_date: formattedChartDate,
          data: {
            bp: [
              {
                systolic: undefined,
                diastolic: convertedCodeAndValue.value.toString(),
              },
            ],
          },
        };
      } else {
        throw new BadRequestError("Unknown LOINC code", undefined, {
          ...additionalInfo,
          loincCode,
        });
      }
    }
    return {
      chart_date: formattedChartDate,
      data: {
        [convertedCodeAndValue.codeKey]: [
          {
            value: convertedCodeAndValue.value.toString(),
          },
        ],
      },
    };
  }

  private convertCodeAndValue(
    loincCode: string,
    value: number | string,
    units: string
  ): { codeKey: string; value: number | string } | undefined {
    const { units: targetUnit, codeKey } = vitalSignCodesMap.get(loincCode) ?? {};
    if (!targetUnit || !codeKey) return undefined;
    if (units === targetUnit) return { codeKey, value };

    if (targetUnit === "lb_av") {
      const valueNumber = typeof value === "string" ? +value : value;
      if (units === "kg" || units === "kilogram" || units === "kilograms") {
        return { codeKey, value: this.convertKgToLbs(valueNumber) }; // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
      }
      if (units === "g" || units === "gram" || units === "grams") {
        return { codeKey, value: this.convertGramsToLbs(valueNumber) }; // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
      }
      if (units === "lb_av" || units.includes("pound")) {
        return { codeKey, value: valueNumber }; // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
      }
    }
    if (targetUnit === "in_i") {
      const valueNumber = typeof value === "string" ? +value : value;
      if (units === "cm" || units === "centimeter") {
        return { codeKey, value: this.convertCmToInches(valueNumber) }; // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
      }
      if (units === "in_i" || units.includes("inch")) {
        return { codeKey, value: valueNumber }; // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
      }
    }
    if (targetUnit === "cm") {
      const valueNumber = typeof value === "string" ? +value : value;
      if (units === "cm" || units === "centimeter") {
        return { codeKey, value: valueNumber }; // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
      }
      if (units === "in_i" || units.includes("inch")) {
        return { codeKey, value: this.convertInchesToCm(valueNumber) }; // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
      }
    }
    if (targetUnit === "degf") {
      const valueNumber = typeof value === "string" ? +value : value;
      if (units === "degf" || units === "f" || units.includes("fahrenheit")) {
        return { codeKey, value: valueNumber }; // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
      }
      if (units === "cel" || units === "c" || units.includes("celsius")) {
        return { codeKey, value: this.convertCelciusToFahrenheit(valueNumber) }; // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
      }
    }
    if (targetUnit === "kg/m2") {
      const valueNumber = typeof value === "string" ? +value : value;
      if (units === "kg/m2" || units === "kg_m2") {
        return { codeKey, value: valueNumber }; // https://hl7.org/fhir/R4/valueset-ucum-bodybmi.html
      }
    }
    throw new BadRequestError("Unknown units", undefined, {
      units,
      loincCode,
      value,
    });
  }

  private convertGramsToLbs(value: number): number {
    return value * gToLbs;
  }

  private convertKgToLbs(value: number): number {
    return value * kgToLbs;
  }

  private convertCmToInches(value: number): number {
    return value * cmToInches;
  }

  private convertInchesToCm(value: number): number {
    return value * inchesToCm;
  }

  private convertCelciusToFahrenheit(value: number): number {
    return value * (9 / 5) + 32;
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
