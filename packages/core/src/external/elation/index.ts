import { errorToString, JwtTokenInfo, MetriportError } from "@metriport/shared";
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
import {
  ApiConfig,
  createDataParams,
  formatDate,
  makeRequest,
  MakeRequestParamsFromMethod,
} from "../../domain/ehr";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { S3Utils } from "../aws/s3";

interface ElationApiConfig extends ApiConfig {
  environment: ElationEnv;
}

const region = Config.getAWSRegion();
const responsesBucket = Config.getEhrResponsesBucketName();
const elationDateFormat = "YYYY-MM-DD";

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export type ElationEnv = "app" | "sandbox";
export function isElationEnv(env: string): env is ElationEnv {
  return env === "app" || env === "sandbox";
}

class ElationApi {
  private axiosInstance: AxiosInstance;
  private baseUrl: string;
  private twoLeggedAuthTokenInfo: JwtTokenInfo | undefined;
  private practiceId: string;
  private s3Utils: S3Utils;

  private constructor(private config: ElationApiConfig) {
    this.twoLeggedAuthTokenInfo = config.twoLeggedAuthTokenInfo;
    this.practiceId = config.practiceId;
    this.s3Utils = getS3UtilsInstance();
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
      method: "GET",
      url: patientUrl,
      schema: patientSchema,
      additionalInfo,
      debug,
    });
    return this.parsePatient({ patient, additionalInfo });
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
      method: "PATCH",
      url: patientUrl,
      data: { metadata },
      headers: { "content-type": "application/json" },
      schema: patientSchema,
      additionalInfo,
      debug,
    });
    return this.parsePatient({ patient, additionalInfo });
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
    url,
    method,
    data,
    headers,
    schema,
    additionalInfo,
    debug,
  }: MakeRequestParamsFromMethod<T>): Promise<T> {
    return await makeRequest<T>({
      ehr: "elation",
      cxId,
      patientId,
      axiosInstance: this.axiosInstance,
      url,
      method,
      data,
      headers,
      schema,
      additionalInfo,
      responsesBucket,
      s3Utils: this.s3Utils,
      debug,
    });
  }

  private formatDate(date: string | undefined): string | undefined {
    return formatDate(date, elationDateFormat);
  }

  private parsePatient({
    patient,
    additionalInfo,
  }: {
    patient: Patient;
    additionalInfo: Record<string, string>;
  }): PatientWithAddress {
    if (!patient.address) {
      throw new MetriportError("No addresses found", undefined, additionalInfo);
    }
    return patientSchemaWithValidAddress.parse(patient);
  }
}

export default ElationApi;
