import { Condition } from "@medplum/fhirtypes";
import { BadRequestError, errorToString, JwtTokenInfo, MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  Appointments,
  appointmentsSchema,
  BookedAppointment,
  bookedAppointmentSchema,
  CreatedProblem,
  createdProblemSchema,
  elationClientJwtTokenResponseSchema,
  Metadata,
  Patient,
  patientSchema,
} from "@metriport/shared/interface/external/elation/index";
import axios, { AxiosInstance } from "axios";
import { fetchCodingCodeOrDisplayOrSystem } from "../../fhir-deduplication/shared";
import { SNOMED_CODE } from "../../util/constants";
import { out } from "../../util/log";
import {
  ApiConfig,
  createDataParams,
  formatDate,
  makeRequest,
  MakeRequestParamsInEhr,
} from "../shared/ehr";

interface ElationApiConfig extends ApiConfig {
  environment: ElationEnv;
}

const elationDateFormat = "YYYY-MM-DD";

const elationEnv = ["app", "sandbox"] as const;
export type ElationEnv = (typeof elationEnv)[number];
export function isElationEnv(env: string): env is ElationEnv {
  return elationEnv.includes(env as ElationEnv);
}

const clinicalStatusActiveCode = "55561003";
const problemStatusesMap = new Map<string, string>();
problemStatusesMap.set("active", "Active");
problemStatusesMap.set("relapse", "Active");
problemStatusesMap.set("recurrence", "Active");
problemStatusesMap.set("remission", "Controlled");
problemStatusesMap.set("resolved", "Resolved");

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
        headers: { "content-type": "application/x-www-form-urlencoded" },
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
        "content-type": "application/x-www-form-urlencoded",
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
      headers: { "content-type": "application/json" },
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
    const snomedCode = this.getConditionSnomedCode(condition);
    if (!snomedCode) {
      throw new BadRequestError("No SNOMED code found for condition", undefined, additionalInfo);
    }
    const startDate = this.getConditionStartDate(condition);
    if (!startDate) {
      throw new BadRequestError("No start date found for condition", undefined, additionalInfo);
    }
    const conditionStatus = this.getConditionStatus(condition);
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
      headers: { "content-type": "application/json" },
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
    };
    const urlParams = new URLSearchParams(params);
    const appointmentUrl = `/appointments/?${urlParams.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
    };
    const appointments = await this.makeRequest<Appointments>({
      cxId,
      s3Path: "appointments",
      method: "GET",
      url: appointmentUrl,
      schema: appointmentsSchema,
      additionalInfo,
      debug,
    });
    const bookedAppointments = appointments.results.filter(
      app => app.patient !== null && app.status !== null && app.status.status === "Scheduled"
    );
    return bookedAppointments.map(a => bookedAppointmentSchema.parse(a));
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
  }: MakeRequestParamsInEhr<T>): Promise<T> {
    return await makeRequest<T>({
      ehr: "elation",
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
    });
  }

  private formatDate(date: string | undefined): string | undefined {
    return formatDate(date, elationDateFormat);
  }

  private getConditionSnomedCode(condition: Condition): string | undefined {
    const code = condition.code;
    const snomedCoding = code?.coding?.find(coding => {
      const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
      return system?.includes(SNOMED_CODE);
    });
    if (!snomedCoding) return undefined;
    return snomedCoding.code;
  }

  private getConditionStartDate(condition: Condition): string | undefined {
    return condition.onsetDateTime ?? condition.onsetPeriod?.start;
  }

  private getConditionStatus(condition: Condition): string | undefined {
    return condition.clinicalStatus?.text ??
      condition.clinicalStatus?.coding?.[0]?.display ??
      condition.clinicalStatus?.coding?.[0]?.code === clinicalStatusActiveCode
      ? "Active"
      : condition.clinicalStatus?.coding?.[0]?.code;
  }
}

export default ElationApi;
