import { Bundle, Condition, Observation, ResourceType } from "@medplum/fhirtypes";
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
  SubscriptionResource,
  Subscriptions,
  subscriptionsSchema,
} from "@metriport/shared/interface/external/ehr/elation/index";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getObservationUnits } from "@metriport/shared/medical/fhir/observations";
import axios, { AxiosInstance } from "axios";
import { z } from "zod";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { uuidv7 } from "../../../util/uuid-v7";
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
  getObservationInterpretation,
  getObservationLoincCode,
  getObservationLoincCoding,
  getObservationObservedDate,
  getObservationResultStatus,
  getObservationUnitAndValue,
  getObservationValue,
  makeRequest,
  MakeRequestParamsInEhr,
  paginateWaitTime,
  partitionEhrBundle,
  saveEhrReferenceBundle,
} from "../shared";

const apiUrl = Config.getApiUrl();

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
vitalSignCodesMap.set("29463-7", { codeKey: "weight", units: "lb_av" });
vitalSignCodesMap.set("8302-2", { codeKey: "height", units: "in_i" });
vitalSignCodesMap.set("56086-2", { codeKey: "wc", units: "cm" });

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
      reference_min?: string;
      reference_max?: string;
      units: string;
      is_abnormal?: string;
      abnormal_flag?: string;
      test: {
        name: string;
        loinc: string;
      };
      test_category: string;
    }[];
  }[];
};

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
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
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

  async createLab({
    cxId,
    patientId,
    observation,
  }: {
    cxId: string;
    patientId: string;
    observation: Observation;
  }): Promise<CreatedVital> {
    const { debug } = out(
      `Elation createVital - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
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
      practiceId: this.practiceId,
      physician: 1,
      ...this.formatLab(observation, additionalInfo),
    };
    const vital = await this.makeRequest<CreatedVital>({
      cxId,
      patientId,
      s3Path: this.createWriteBackPath("lab", observation.id),
      method: "POST",
      url: reportsUrl,
      data,
      schema: createdVitalSchema,
      additionalInfo,
      headers: { "Content-Type": "application/json" },
      debug,
    });
    return vital;
  }

  async createVital({
    cxId,
    patientId,
    observation,
  }: {
    cxId: string;
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
    const data = {
      patient: patientId,
      practiceId: this.practiceId,
      ...this.formatVital(observation, additionalInfo),
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
    });
  }

  private formatDate(date: string | undefined): string | undefined {
    return formatDate(date, elationDateFormat);
  }

  private formatDateTime(date: string | undefined): string | undefined {
    return formatDate(date, elationDateTimeFormat);
  }

  private createWriteBackPath(resourceType: string, resourceId: string | undefined): string {
    return `write-back/${resourceType}/${resourceId ?? "unknown"}`;
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
    const [units, value] = unitAndValue;
    const referenceRange = buildObservationReferenceRange(observation);
    const resultStatus = getObservationResultStatus(observation);
    if (!resultStatus) {
      throw new BadRequestError(
        "No result status found for observation",
        undefined,
        additionalInfo
      );
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
    const isAbnormal = interpretation !== "normal";
    return {
      report_type: "Lab",
      document_date: formattedObservedDate,
      reported_date: formattedObservedDate,
      chart_date: this.formatDateTime(buildDayjs().toISOString()) ?? "",
      grids: [
        {
          accession_number: uuidv7(),
          resulted_date: formattedObservedDate,
          collected_date: formattedObservedDate,
          status: resultStatus,
          note: "Added via Metriport App",
          results: [
            {
              status: resultStatus,
              value: value.toString(),
              ...(referenceRange?.low ? { reference_min: referenceRange.low.toString() } : {}),
              ...(referenceRange?.high ? { reference_max: referenceRange.high.toString() } : {}),
              units,
              is_abnormal: isAbnormal ? "1" : "0",
              abnormal_flag: interpretation,
              test: {
                name: loincCoding.display,
                loinc: loincCoding.code,
              },
              test_category: loincCoding.display,
            },
          ],
        },
      ],
    };
  }

  private formatVital(
    observation: Observation,
    additionalInfo: Record<string, string | undefined>
  ): Record<string, { value: string }[]> {
    const loincCode = getObservationLoincCode(observation);
    if (!loincCode) {
      throw new BadRequestError("No code found for observation", undefined, additionalInfo);
    }
    const codeAndUnits = vitalSignCodesMap.get(loincCode);
    if (!codeAndUnits) {
      throw new BadRequestError("No valid code found for LOINC code", undefined, additionalInfo);
    }
    const units = getObservationUnits(observation);
    if (!units) {
      throw new BadRequestError("No units found for observation", undefined, additionalInfo);
    }
    const value = getObservationValue(observation);
    if (!value) {
      throw new BadRequestError("No value found for observation", undefined, additionalInfo);
    }
    const unitAndValue = this.convertUnitAndValue(loincCode, +value, units);
    if (!unitAndValue) {
      throw new BadRequestError(
        "No unit and value found for observation",
        undefined,
        additionalInfo
      );
    }
    return {
      [codeAndUnits.codeKey]: [
        {
          value: unitAndValue.value.toString(),
        },
      ],
    };
  }

  private convertUnitAndValue(
    loincCode: string,
    value: number,
    units: string
  ): { value: number | string } | undefined {
    const { units: targetUnit } = vitalSignCodesMap.get(loincCode) ?? {};
    if (!targetUnit) return undefined;
    if (units === targetUnit) return { value };
    if (targetUnit === "lb_av") {
      if (units === "kg" || units === "kilogram" || units === "kilograms")
        return { value: this.convertKgToLbs(value) }; // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
      if (units === "g" || units === "gram" || units === "grams")
        return { value: this.convertGramsToLbs(value) }; // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
      if (units === "lb_av" || units.includes("pound")) return { value }; // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    }
    if (targetUnit === "in_i") {
      if (units === "cm" || units === "centimeter") return { value: this.convertCmToInches(value) }; // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
      if (units === "in_i" || units.includes("inch")) return { value }; // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
    }
    if (targetUnit === "cm") {
      if (units === "cm" || units === "centimeter") return { value }; // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
      if (units === "in_i" || units.includes("inch"))
        return { value: this.convertInchesToCm(value) }; // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
    }
    if (targetUnit === "degf") {
      if (units === "degf" || units === "f" || units.includes("fahrenheit")) return { value }; // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
      if (units === "cel" || units === "c" || units.includes("celsius"))
        return { value: this.convertCelciusToFahrenheit(value) }; // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html}
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
}

export default ElationApi;
