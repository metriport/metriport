import axios, { AxiosInstance, AxiosResponse, AxiosError } from "axios";
import { Medication, MedicationStatement } from "@medplum/fhirtypes";
import {
  patientResourceSchema,
  PatientResource,
} from "@metriport/shared/interface/external/athenahealth/patient";
import { errorToString } from "@metriport/shared";
import { S3Utils } from "../aws/s3";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { Config } from "../../util/config";
import { uuidv7 } from "../../util/uuid-v7";
import { createHivePartitionFilePath } from "../../domain/filename";

interface ApiConfig {
  threeLeggedAuthToken: string;
  practiceId: string;
  environment: "api" | "api.preview";
  clientId: string;
  clientSecret: string;
}

const region = Config.getAWSRegion();
const responsesBucket = Config.getEhrResponsesBucketName();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

class AthenaHealthApi {
  private axiosInstanceFhirApi: AxiosInstance;
  private axiosInstanceProprietary: AxiosInstance;
  private twoLeggedAuthToken: string;
  private threeLeggedAuthToken: string;
  private practiceId: string;
  private s3Utils: S3Utils;

  private constructor(private config: ApiConfig) {
    this.twoLeggedAuthToken = "";
    this.threeLeggedAuthToken = config.threeLeggedAuthToken;
    this.practiceId = config.practiceId;
    this.s3Utils = getS3UtilsInstance();
    this.axiosInstanceFhirApi = axios.create({});
    this.axiosInstanceProprietary = axios.create({});
  }

  public static async create(config: ApiConfig): Promise<AthenaHealthApi> {
    const instance = new AthenaHealthApi(config);
    await instance.initialize();
    return instance;
  }

  private async fetchtwoLeggedAuthToken(): Promise<void> {
    const url = `https://${this.config.environment}.platform.athenahealth.com/oauth2/v1/token`;
    const payload = `grant_type=client_credentials&client_id=${this.config.clientId}&client_secret=${this.config.clientSecret}&scope=athena/service/Athenanet.MDP.*`;

    try {
      const response = await axios.post(url, payload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      this.twoLeggedAuthToken = response.data.access_token;
    } catch (error) {
      throw new Error("Failed to fetch Two Legged OAuth token");
    }
  }

  async initialize(): Promise<void> {
    await this.fetchtwoLeggedAuthToken();

    this.axiosInstanceFhirApi = axios.create({
      baseURL: `https://${this.config.environment}.platform.athenahealth.com/fhir/r4`,
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${this.threeLeggedAuthToken}`,
        "content-type": "application/x-www-form-urlencoded",
      },
    });

    this.axiosInstanceProprietary = axios.create({
      baseURL: `https://${this.config.environment}.platform.athenahealth.com/v1/${this.practiceId}`,
      headers: {
        Authorization: `Bearer ${this.twoLeggedAuthToken}`,
        "content-type": "application/x-www-form-urlencoded",
      },
    });
  }

  private async handleAxiosRequest<T>(
    requestFunction: () => Promise<AxiosResponse<T>>
  ): Promise<AxiosResponse<T>> {
    try {
      const response = await requestFunction();
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status;
        const errorMessage = axiosError.response?.data;
        const msg = `Request failed. Status: ${statusCode}. Message: ${JSON.stringify(
          errorMessage
        )}`;
        console.log("error", JSON.stringify(error, null, 2));
        throw new Error(msg);
      }
      throw new Error("An unexpected error occurred during the request");
    }
  }

  async getPatient({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<PatientResource | undefined> {
    const { log, debug } = out(`AthenaHealth get - AH patientId ${patientId}`);
    try {
      const patientUrl = `/Patient/${patientId}`;
      const response = await this.handleAxiosRequest(() =>
        this.axiosInstanceFhirApi.get(patientUrl)
      );
      if (!response.data) throw new Error(`No body returned from ${patientUrl}`);
      debug(`${patientUrl} resp: ${JSON.stringify(response.data)}`);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = `athenahealth/${filePath}/${uuidv7()}.json`;
        await this.s3Utils.uploadFile({
          bucket: responsesBucket,
          key,
          file: Buffer.from(JSON.stringify(response.data), "utf8"),
          contentType: "application/json",
        });
      }
      return patientResourceSchema.parse(response.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.response?.status === 404) return undefined;
      const msg = `Failure while getting patient @ AthenHealth`;
      log(`${msg}. Patient ID: ${patientId}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          baseUrl: this.axiosInstanceFhirApi.getUri(),
          patientId,
          context: "athenahealth.get-patient",
          error,
        },
      });
      throw error;
    }
  }

  async createMedication({
    cxId,
    patientId,
    departmentId,
    medication,
    medicationStatement,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    medication: Medication;
    medicationStatement?: MedicationStatement;
  }): Promise<{
    success: string;
    errormessage: string;
    medicationentryid: string;
  }> {
    const { log, debug } = out(`AthenaHealth create medication - AH patientId ${patientId}`);
    const medicationOptions = await this.searchForMedication({ cxId, patientId, medication });
    if (medicationOptions.length === 0) throw new Error("No medication options found");
    if (medicationOptions.length > 1) {
      capture.message("Found multiple matching medications in AthenaHealth", {
        extra: {
          cxId,
          patientId,
          medication,
          medicationOptions,
        },
        level: "warning",
      });
    }
    const data = {
      departmentid: departmentId,
      providernote: "Added via Metriport App",
      unstructuredsig: "Metriport",
      medicationid: `${medicationOptions[0]?.medicationid}`,
      hidden: "false",
      startdate: medicationStatement?.effectivePeriod?.start ?? "",
      stopdate: medicationStatement?.effectivePeriod?.end ?? "",
      stopreason: "",
      patientnote: "",
      THIRDPARTYUSERNAME: "",
      PATIENTFACINGCALL: "",
    };
    try {
      const patientUrl = `/Patient/${patientId}`;
      const response = await this.handleAxiosRequest(() =>
        this.axiosInstanceFhirApi.post(patientUrl, this.createDataParams(data))
      );
      if (!response.data) throw new Error(`No body returned from ${patientUrl}`);
      debug(`${patientUrl} resp: ${JSON.stringify(response.data)}`);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = `athenahealth/${filePath}/${uuidv7()}.json`;
        await this.s3Utils.uploadFile({
          bucket: responsesBucket,
          key,
          file: Buffer.from(JSON.stringify(response.data), "utf8"),
          contentType: "application/json",
        });
      }
      return response.data;
    } catch (error) {
      const msg = `Failure while creating medication @ AthenHealth`;
      log(`${msg}. Patient ID: ${patientId}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          baseUrl: this.axiosInstanceFhirApi.getUri(),
          patientId,
          context: "athenahealth.create-medication",
          error,
        },
      });
      throw error;
    }
  }

  async searchForMedication({
    cxId,
    patientId,
    medication,
  }: {
    cxId: string;
    patientId: string;
    medication: Medication;
  }): Promise<{ medication: string; medicationid: number }[]> {
    const { log, debug } = out(`AthenaHealth search for medication - AH patientId ${patientId}`);
    const searchValue = medication.code?.coding?.[0]?.display;
    if (!searchValue || searchValue.length < 2) throw Error("Need sufficient code to proceed.");
    try {
      const referenceUrl = `/reference/medications?searchvalue=${searchValue}`;
      const response = await this.handleAxiosRequest(() =>
        this.axiosInstanceProprietary.get(referenceUrl)
      );
      if (!response.data) throw new Error(`No body returned from ${referenceUrl}`);
      debug(`${referenceUrl} resp: ${JSON.stringify(response.data)}`);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = `athenahealth/${referenceUrl}/${filePath}/${uuidv7()}.json`;
        await this.s3Utils.uploadFile({
          bucket: responsesBucket,
          key,
          file: Buffer.from(JSON.stringify(response.data), "utf8"),
          contentType: "application/json",
        });
      }
      return response.data;
    } catch (error) {
      const msg = `Failure while searching for medications @ AthenHealth`;
      log(`${msg}. Patient ID: ${patientId}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          baseUrl: this.axiosInstanceProprietary.getUri(),
          patientId,
          context: "athenahealth.search for medication",
          error,
        },
      });
      throw error;
    }
  }

  private createDataParams(data: { [key: string]: string }): string {
    return Object.entries(data)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
  }
}

export default AthenaHealthApi;
