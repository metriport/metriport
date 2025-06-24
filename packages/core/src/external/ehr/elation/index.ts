import { Bundle, Condition, ResourceType } from "@medplum/fhirtypes";
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
  elationClientJwtTokenResponseSchema,
  Metadata,
  Patient,
  patientSchema,
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
  convertEhrBundleToValidEhrStrictBundle,
  createDataParams,
  fetchEhrBundleUsingCache,
  formatDate,
  getConditionSnomedCode,
  getConditionStartDate,
  getConditionStatus,
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

  async getCcdaDocument({
    cxId,
    patientId,
    resourceType,
  }: {
    cxId: string;
    patientId: string;
    resourceType?: string;
  }): Promise<{ payload: string; s3key: string; s3BucketName: string }> {
    const { debug } = out(
      `Elation getCcdaDocument - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} resourceType ${resourceType}`
    );
    if (resourceType && !isSupportedCcdaSectionResource(resourceType)) {
      throw new BadRequestError("Invalid resource type", undefined, {
        resourceType,
      });
    }
    const section = resourceType ? ccdaSectionMap.get(resourceType as ResourceType) : undefined;
    const params = new URLSearchParams({ ...(section && { section }) });
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
    const payload = atob(document.base64_ccda);
    const { s3key, s3BucketName } = await createOrReplaceCcda({
      ehr: EhrSources.elation,
      cxId,
      metriportPatientId: patientId,
      ehrPatientId: patientId,
      payload,
      resourceType: s3PathResourceType,
    });
    return { payload, s3key, s3BucketName };
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
      s3Path: "problem",
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
      outputS3Key: string;
      outputS3BucketName: string;
    }) => Promise<EhrFhirResourceBundle>;
    useCachedBundle?: boolean;
  }): Promise<Bundle> {
    if (!isSupportedElationResource(resourceType)) {
      throw new BadRequestError("Invalid resource type", undefined, {
        resourceType,
      });
    }
    const { s3key, s3BucketName } = await this.getCcdaDocument({
      cxId,
      patientId: elationPatientId,
      resourceType,
    });
    let referenceEhrFhirBundle: EhrFhirResourceBundle | undefined;
    async function fetchResourcesFromEhr() {
      const bundle = await fhirConverterToEhrBundle({
        inputS3Key: s3key,
        inputS3BucketName: s3BucketName,
        outputS3Key: `${s3key}.json`,
        outputS3BucketName: s3BucketName,
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
}

export default ElationApi;
