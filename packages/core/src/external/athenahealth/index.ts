import axios, { AxiosInstance, AxiosResponse, AxiosError } from "axios";
import {
  Medication,
  MedicationAdministration,
  MedicationDispense,
  MedicationStatement,
} from "@medplum/fhirtypes";
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
  environment: AthenaEnv;
  clientKey: string;
  clientSecret: string;
}

const region = Config.getAWSRegion();
const responsesBucket = Config.getEhrResponsesBucketName();
const athenaPracticePrefix = "Practice";
const athenaPatientPrefix = "E";
const athenaDepartmentPrefix = "Department";

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export type AthenaEnv = "api" | "api.preview";

export type AthenaMedication = { medication: string; medicationid: number };

export type MedicationWithRefs = {
  medication: Medication;
  administration?: MedicationAdministration;
  dispense?: MedicationDispense;
  statement?: MedicationStatement;
};

class AthenaHealthApi {
  private axiosInstanceFhirApi: AxiosInstance;
  private axiosInstanceProprietary: AxiosInstance;
  private baseUrl: string;
  private twoLeggedAuthToken: string;
  private threeLeggedAuthToken: string;
  private practiceId: string;
  private s3Utils: S3Utils;

  private constructor(private config: ApiConfig) {
    this.twoLeggedAuthToken = "";
    this.threeLeggedAuthToken = config.threeLeggedAuthToken;
    this.practiceId = this.stripPracticeId(config.practiceId);
    this.s3Utils = getS3UtilsInstance();
    this.axiosInstanceFhirApi = axios.create({});
    this.axiosInstanceProprietary = axios.create({});
    this.baseUrl = `https://${config.environment}.platform.athenahealth.com/`;
  }

  public static async create(config: ApiConfig): Promise<AthenaHealthApi> {
    const instance = new AthenaHealthApi(config);
    await instance.initialize();
    return instance;
  }

  private async fetchtwoLeggedAuthToken(): Promise<void> {
    const url = `${this.baseUrl}/oauth2/v1/token`;
    const payload = `grant_type=client_credentials&scope=athena/service/Athenanet.MDP.*`;

    try {
      const response = await axios.post(url, payload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        auth: {
          username: this.config.clientKey,
          password: this.config.clientSecret,
        },
      });

      this.twoLeggedAuthToken = response.data.access_token;
    } catch (error) {
      throw new Error("Failed to fetch Two Legged Auth token");
    }
  }

  async initialize(): Promise<void> {
    await this.fetchtwoLeggedAuthToken();

    this.axiosInstanceFhirApi = axios.create({
      baseURL: `${this.baseUrl}/fhir/r4`,
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${this.threeLeggedAuthToken}`,
        "content-type": "application/x-www-form-urlencoded",
      },
    });

    this.axiosInstanceProprietary = axios.create({
      baseURL: `${this.baseUrl}/v1/${this.practiceId}`,
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
        const key = `athenahealth/patient/${filePath}/${uuidv7()}.json`;
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
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    medication: MedicationWithRefs;
  }): Promise<{
    success: string;
    errormessage: string;
    medicationentryid: string;
  }> {
    const { log, debug } = out(`AthenaHealth create medication - AH patientId ${patientId}`);
    const medicationOptions = await this.searchForMedication({
      cxId,
      patientId,
      medication: medication.medication,
    });
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
      departmentid: this.stripDepartmentId(departmentId),
      providernote: "Added via Metriport App",
      unstructuredsig: "Metriport",
      medicationid: `${medicationOptions[0]?.medicationid}`,
      hidden: "false",
      startdate: medication.statement?.effectivePeriod?.start ?? undefined,
      stopdate: medication.statement?.effectivePeriod?.end ?? undefined,
      stopreason: undefined,
      patientnote: undefined,
      THIRDPARTYUSERNAME: undefined,
      PATIENTFACINGCALL: undefined,
    };
    try {
      const chartMedicationUrl = `/chart/${this.stripPatientId(patientId)}/medications`;
      const response = await this.handleAxiosRequest(() =>
        this.axiosInstanceProprietary.post(chartMedicationUrl, this.createDataParams(data))
      );
      if (!response.data) throw new Error(`No body returned from ${chartMedicationUrl}`);
      debug(`${chartMedicationUrl} resp: ${JSON.stringify(response.data)}`);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = `athenahealth/chart/medication/${filePath}/${uuidv7()}.json`;
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
  }): Promise<AthenaMedication[]> {
    const { log, debug } = out(`AthenaHealth search for medication - AH patientId ${patientId}`);
    const searchValues = medication.code?.coding?.flatMap(c => c.display?.split("/") ?? []);
    if (!searchValues) throw Error("No code displays values for searching medications.");
    const medicationOptions: AthenaMedication[] = [];
    await Promise.all(
      searchValues.map(async searchValue => {
        if (searchValue.length < 2) return;
        console.log(searchValue);
        try {
          const referenceUrl = `/reference/medications?searchvalue=${searchValue}`;
          const response = await this.handleAxiosRequest(() =>
            this.axiosInstanceProprietary.get(referenceUrl)
          );
          if (!response.data) throw new Error(`No body returned from ${referenceUrl}`);
          debug(`${referenceUrl} resp: ${JSON.stringify(response.data)}`);
          const medications = response.data as AthenaMedication[];
          medicationOptions.push(...medications);
        } catch (error) {
          const msg = `Failure while searching for medications @ AthenHealth`;
          log(`${msg}. Patient ID: ${patientId}. Cause: ${errorToString(error)}`);
          capture.error(msg, {
            extra: {
              baseUrl: this.axiosInstanceProprietary.getUri(),
              patientId,
              context: "athenahealth.search-for-medication",
              error,
            },
          });
          throw error;
        }
      })
    );
    if (responsesBucket) {
      const filePath = createHivePartitionFilePath({
        cxId,
        patientId,
        date: new Date(),
      });
      const key = `athenahealth/reference/medications/${filePath}/${uuidv7()}.json`;
      await this.s3Utils.uploadFile({
        bucket: responsesBucket,
        key,
        file: Buffer.from(JSON.stringify(medicationOptions), "utf8"),
        contentType: "application/json",
      });
    }
    return medicationOptions;
  }

  private createDataParams(data: { [key: string]: string | undefined }): string {
    return Object.entries(data)
      .flatMap(([k, v]) => (v ? [`${k}=${v}`] : []))
      .join("&");
  }

  private stripPracticeId(id: string) {
    return id.replace(`a-1.${athenaPracticePrefix}-`, "");
  }

  private stripPatientId(id: string) {
    return id.replace(`a-${this.practiceId}.${athenaPatientPrefix}-`, "");
  }

  private stripDepartmentId(id: string) {
    return id.replace(`a-${this.practiceId}.${athenaDepartmentPrefix}-`, "");
  }
}

export default AthenaHealthApi;
