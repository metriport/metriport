import {
  AdditionalInfo,
  BadRequestError,
  errorToString,
  JwtTokenInfo,
  MetriportError,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  Appointments,
  appointmentsSchema,
  BookedAppointment,
  bookedAppointmentSchema,
  elationClientJwtTokenResponseSchema,
  Metadata,
  Patient,
  patientSchema,
  patientSchemaWithValidAddress,
  PatientWithAddress,
} from "@metriport/shared/interface/external/elation/index";
import axios, { AxiosInstance } from "axios";
import { z } from "zod";
import { createHivePartitionFilePath } from "../../domain/filename";
import { Config } from "../../util/config";
import { processAsyncError } from "../../util/error/shared";
import { out } from "../../util/log";
import { uuidv7 } from "../../util/uuid-v7";
import { S3Utils } from "../aws/s3";

interface ApiConfig {
  twoLeggedAuthTokenInfo?: JwtTokenInfo | undefined;
  practiceId: string;
  environment: ElationEnv;
  clientKey: string;
  clientSecret: string;
}

const region = Config.getAWSRegion();
const responsesBucket = Config.getEhrResponsesBucketName();
const elationDateFormat = "YYYY-MM-DD";

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

type RequestData = { [key: string]: string | boolean | object | undefined };

const elationEnv = ["app", "sandbox"] as const;
export type ElationEnv = (typeof elationEnv)[number];
export function isElationEnv(env: string): env is ElationEnv {
  return elationEnv.includes(env as ElationEnv);
}

class ElationApi {
  private axiosInstance: AxiosInstance;
  private baseUrl: string;
  private twoLeggedAuthTokenInfo: JwtTokenInfo | undefined;
  private practiceId: string;
  private s3Utils: S3Utils;

  private constructor(private config: ApiConfig) {
    this.twoLeggedAuthTokenInfo = config.twoLeggedAuthTokenInfo;
    this.practiceId = config.practiceId;
    this.s3Utils = getS3UtilsInstance();
    this.axiosInstance = axios.create({});
    this.baseUrl = `https://${config.environment}.elationemr.com/api/2.0`;
  }

  public static async create(config: ApiConfig): Promise<ElationApi> {
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
      const response = await axios.post(url, this.createDataParams(data), {
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
    } else if (this.twoLeggedAuthTokenInfo.exp < new Date()) {
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

  async getPatient({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<PatientWithAddress> {
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
    try {
      return this.parsePatient(patient);
    } catch (error) {
      throw new BadRequestError("Failed to parse patient", undefined, {
        ...additionalInfo,
        error: errorToString(error),
      });
    }
  }

  async updatePatientMetadata({
    cxId,
    patientId,
    metadata,
  }: {
    cxId: string;
    patientId: string;
    metadata: Metadata;
  }): Promise<PatientWithAddress> {
    const { debug } = out(
      `Elation uupdatePatientMetadata - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
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
    try {
      return this.parsePatient(patient);
    } catch (error) {
      throw new BadRequestError("Failed to parse patient", undefined, {
        ...additionalInfo,
        error: errorToString(error),
      });
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
    headers,
    data,
    schema,
    additionalInfo,
    debug,
  }: {
    cxId: string;
    patientId?: string;
    s3Path: string;
    url: string;
    method: "GET" | "POST" | "PATCH";
    headers?: Record<string, string>;
    data?: RequestData;
    schema: z.Schema<T>;
    additionalInfo: AdditionalInfo;
    debug: typeof console.log;
  }): Promise<T> {
    const response = await this.axiosInstance.request({
      method,
      url,
      data: method === "GET" ? undefined : this.createDataParams(data ?? {}),
      headers: {
        ...this.axiosInstance.defaults.headers.common,
        ...headers,
      },
    });
    if (!response.data) {
      throw new MetriportError(`No body returned from ${method} ${url}`, undefined, additionalInfo);
    }
    const body = response.data;
    debug(`${method} ${url} resp: `, () => JSON.stringify(response.data));
    if (responsesBucket) {
      const filePath = createHivePartitionFilePath({
        cxId,
        patientId: patientId ?? "global",
        date: new Date(),
      });
      const key = this.buildS3Path(s3Path, filePath);
      this.s3Utils
        .uploadFile({
          bucket: responsesBucket,
          key,
          file: Buffer.from(JSON.stringify(response.data), "utf8"),
          contentType: "application/json",
        })
        .catch(processAsyncError(`Error saving to s3 @ Elation - ${method} ${url}`));
    }
    const outcome = schema.safeParse(body);
    if (!outcome.success) {
      throw new MetriportError(`${method} ${url} response not parsed`, undefined, {
        ...additionalInfo,
        error: errorToString(outcome.error),
      });
    }
    return outcome.data;
  }

  private createDataParams(data: RequestData): string {
    const dataParams = new URLSearchParams();
    Object.entries(data).forEach(([k, v]) => {
      if (v === undefined) return;
      dataParams.append(k, typeof v === "object" ? JSON.stringify(v) : v.toString());
    });
    return dataParams.toString();
  }

  private buildS3Path(method: string, key: string): string {
    return `elation/${method}/${key}/${uuidv7()}.json`;
  }

  private formatDate(date: string | undefined): string | undefined {
    if (!date) return undefined;
    const trimmedDate = date.trim();
    const parsedDate = buildDayjs(trimmedDate);
    if (!parsedDate.isValid()) return undefined;
    return parsedDate.format(elationDateFormat);
  }

  private parsePatient(patient: Patient): PatientWithAddress {
    if (!patient.address) throw new BadRequestError("No addresses found");
    return patientSchemaWithValidAddress.parse(patient);
  }
}

export default ElationApi;
