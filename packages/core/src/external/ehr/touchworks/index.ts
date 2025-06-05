import { Patient, patientSchema } from "@metriport/shared/interface/external/ehr/patient";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosInstance } from "axios";
import { out } from "../../../util/log";
import { ApiConfig, makeRequest, MakeRequestParamsInEhr } from "../shared";

interface TouchWorksApiConfig
  extends Omit<ApiConfig, "twoLeggedAuthTokenInfo" | "clientKey" | "clientSecret"> {
  environment: TouchWorksEnv;
  authToken: string;
}

const touchworksEnv = ["production", "staging"] as const;

export type TouchWorksEnv = (typeof touchworksEnv)[number];
export function isTouchWorksEnv(env: string): env is TouchWorksEnv {
  return touchworksEnv.includes(env as TouchWorksEnv);
}

class TouchWorksApi {
  private axiosFhirInstance: AxiosInstance;
  private baseFhirUrl: string;
  private practiceId: string;
  private token: string;

  private constructor(config: TouchWorksApiConfig) {
    this.practiceId = config.practiceId;
    this.baseFhirUrl = `https://${
      config.environment === "production" ? "" : "staging-"
    }fhir.touchworks.com`;
    this.axiosFhirInstance = axios.create({});
    this.token = config.authToken;
  }

  public static async create(config: TouchWorksApiConfig): Promise<TouchWorksApi> {
    const instance = new TouchWorksApi(config);
    await instance.initialize();
    return instance;
  }

  async initialize(): Promise<void> {
    this.axiosFhirInstance = axios.create({
      baseURL: `${this.baseFhirUrl}/fhir/r4/${this.practiceId}`,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }

  async getPatient({ cxId, patientId }: { cxId: string; patientId: string }): Promise<Patient> {
    const { debug } = out(
      `TouchWorks getPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientUrl = `/Patient/${patientId}`;
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
      ehr: EhrSources.touchworks,
      cxId,
      practiceId: this.practiceId,
      patientId,
      s3Path,
      axiosInstance: this.axiosFhirInstance,
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
}

export default TouchWorksApi;
