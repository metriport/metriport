import { errorToString, MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  Appointment,
  appointmentsGetResponseSchema,
  Metadata,
  PatientResource,
  patientResourceSchema,
  Resource,
} from "@metriport/shared/interface/external/elation/index";
import axios, { AxiosInstance } from "axios";
import { createHivePartitionFilePath } from "../../domain/filename";
import { Config } from "../../util/config";
import { processAsyncError } from "../../util/error/shared";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { uuidv7 } from "../../util/uuid-v7";
import { S3Utils } from "../aws/s3";

interface ApiConfig {
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

export type ElationEnv = "app" | "sandbox";
export function isElationEnv(env: string): env is ElationEnv {
  return env === "app" || env === "sandbox";
}

class ElationApi {
  private axiosInstance: AxiosInstance;
  private baseUrl: string;
  private twoLeggedAuthToken: string;
  private practiceId: string;
  private s3Utils: S3Utils;

  private constructor(private config: ApiConfig) {
    this.twoLeggedAuthToken = "";
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

  private async fetchTwoLeggedAuthToken(): Promise<void> {
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

      this.twoLeggedAuthToken = response.data.access_token;
    } catch (error) {
      throw new MetriportError("Failed to fetch Two Legged Auth token");
    }
  }

  async initialize(): Promise<void> {
    await this.fetchTwoLeggedAuthToken();

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.twoLeggedAuthToken}`,
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
  }): Promise<PatientResource | undefined> {
    const { log, debug } = out(
      `Elation get patient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientUrl = `/patients/${patientId}/`;
    try {
      const response = await this.axiosInstance.get(patientUrl);
      if (!response.data) throw new MetriportError(`No body returned from ${patientUrl}`);
      debug(`${patientUrl} resp: `, () => JSON.stringify(response.data));
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = `elation/patient/${filePath}/${uuidv7()}.json`;
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ Elation - getPatient"));
      }
      const patient = patientResourceSchema.safeParse(response.data);
      if (!patient.success) {
        const error = patient.error;
        const msg = "Patient from Elation could not be parsed";
        log(`${msg} - error ${errorToString(error)}`);
        capture.message(msg, {
          extra: {
            url: patientUrl,
            cxId,
            practiceId: this.practiceId,
            patientId,
            error,
            context: "elation.get-patient",
          },
          level: "info",
        });
        return undefined;
      }
      return patient.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.response?.status === 404) return undefined;
      const msg = `Failure while getting patient @ Elation`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: patientUrl,
          cxId,
          practiceId: this.practiceId,
          patientId,
          context: "elation.get-patient",
          error,
        },
      });
      throw error;
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
  }): Promise<PatientResource | undefined> {
    const { log, debug } = out(
      `Elation update patient metadata - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientUrl = `/patients/${patientId}/`;
    try {
      const response = await this.axiosInstance.patch(
        patientUrl,
        { metadata },
        {
          headers: {
            ...this.axiosInstance.defaults.headers.common,
            "content-type": "application/json",
          },
        }
      );
      if (!response.data) throw new MetriportError(`No body returned from ${patientUrl}`);
      debug(`${patientUrl} resp: `, () => JSON.stringify(response.data));
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = `elation/patient-update-metadata/${filePath}/${uuidv7()}.json`;
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ Elation - updatePatient"));
      }
      const patient = patientResourceSchema.safeParse(response.data);
      if (!patient.success) {
        const error = patient.error;
        const msg = "Patient from Elation could not be parsed";
        log(`${msg} - error ${errorToString(error)}`);
        capture.message(msg, {
          extra: {
            url: patientUrl,
            cxId,
            practiceId: this.practiceId,
            patientId,
            error,
            context: "elation.update-patient",
          },
          level: "info",
        });
        return undefined;
      }
      return patient.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.response?.status === 404) return undefined;
      const msg = `Failure while updating patient @ Elation`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: patientUrl,
          cxId,
          practiceId: this.practiceId,
          patientId,
          context: "elation.update-patient",
          error,
        },
      });
      throw error;
    }
  }

  async subscribeToEventViaWebhook({
    cxId,
    resource,
    webhookBaseUrl,
  }: {
    cxId: string;
    resource: Resource;
    webhookBaseUrl: string;
  }): Promise<void> {
    const { log, debug } = out(
      `Elation subscribe to event - cxId ${cxId} practiceId ${this.practiceId} resource ${resource} webhookBaseUrl ${webhookBaseUrl}`
    );
    const subscribeUrl = `/app/subscriptions`;
    try {
      const response = await this.axiosInstance.post(
        subscribeUrl,
        this.createDataParams({
          resource,
          target: this.createWebhookUrl(this.practiceId, webhookBaseUrl),
        })
      );
      if (!response.data) throw new MetriportError(`No body returned from ${subscribeUrl}`);
      debug(`${subscribeUrl} resp: `, () => JSON.stringify(response.data));
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId: "global",
          date: new Date(),
        });
        const key = `elation/subscribe/${filePath}/${uuidv7()}.json`;
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ Elation - subscribeToEvent"));
      }
    } catch (error) {
      const msg = `Failure while subscribing to event @ Elation`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: subscribeUrl,
          cxId,
          practiceId: this.practiceId,
          resource,
          webhookBaseUrl,
          context: "elation.subscribe-to-event",
          error,
        },
      });
      throw error;
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
  }): Promise<Appointment[]> {
    const { log, debug } = out(
      `Elation get appointments - cxId ${cxId} practiceId ${this.practiceId}`
    );
    const params = {
      from_date: this.formatDate(fromDate.toISOString()) ?? "",
      to_date: this.formatDate(toDate.toISOString()) ?? "",
    };
    const urlParams = new URLSearchParams(params);
    const appointmentUrl = `/appointments/?${urlParams.toString()}`;
    try {
      const response = await this.axiosInstance.get(appointmentUrl);
      if (!response.data) throw new MetriportError(`No body returned from ${appointmentUrl}`);
      debug(`${appointmentUrl} resp: `, () => JSON.stringify(response.data));
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId: "global",
          date: new Date(),
        });
        const key = `elation/appointments/${filePath}/${uuidv7()}.json`;
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ Elation - getAppointments"));
      }
      const appointments = appointmentsGetResponseSchema.parse(response.data).results;
      return appointments.filter(
        app => app.patient !== null && app.status?.status === "Scheduled"
      ) as Appointment[];
    } catch (error) {
      const msg = `Failure while getting appointments @ Elation`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: appointmentUrl,
          cxId,
          practiceId: this.practiceId,
          context: "elation.get-appointments",
          error,
        },
      });
      throw error;
    }
  }

  private createDataParams(data: { [key: string]: string | undefined }): string {
    return Object.entries(data)
      .flatMap(([k, v]) => (v ? [`${k}=${v}`] : []))
      .join("&");
  }

  private createWebhookUrl(praticeId: string, baseUrl: string): string {
    return `${baseUrl}/${praticeId}`;
  }

  private formatDate(date: string | undefined): string | undefined {
    if (!date) return undefined;
    const trimmedDate = date.trim();
    const parsedDate = buildDayjs(trimmedDate);
    if (!parsedDate.isValid()) return undefined;
    return parsedDate.format(elationDateFormat);
  }
}

export default ElationApi;
