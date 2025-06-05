import { Condition } from "@medplum/fhirtypes";
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
  Appointment,
  AppointmentListResponse,
  appointmentListResponseSchema,
  BookedAppointment,
  bookedAppointmentSchema,
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
import {
  ApiConfig,
  createDataParams,
  formatDate,
  getConditionSnomedCode,
  getConditionStartDate,
  getConditionStatus,
  makeRequest,
  MakeRequestParamsInEhr,
  paginateWaitTime,
} from "../shared";

const apiUrl = Config.getApiUrl();

interface ElationApiConfig extends ApiConfig {
  environment: ElationEnv;
}

const elationDateFormat = "YYYY-MM-DD";
const maxSubscribeAttempts = 3;

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
      limit: "1000",
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
      await sleep(paginateWaitTime);
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
