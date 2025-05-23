import { Patient, patientSchema } from "@metriport/shared/interface/external/ehr/patient";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosInstance } from "axios";
import { out } from "../../../util/log";
import { ApiConfig, makeRequest, MakeRequestParamsInEhr } from "../shared";

interface EClinicalWorksApiConfig
  extends Omit<ApiConfig, "twoLeggedAuthTokenInfo" | "clientKey" | "clientSecret"> {
  environment: EClinicalWorksEnv;
  authToken: string;
}

const eclinicalworksEnv = ["production", "staging"] as const;

export type EClinicalWorksEnv = (typeof eclinicalworksEnv)[number];
export function isEClinicalWorksEnv(env: string): env is EClinicalWorksEnv {
  return eclinicalworksEnv.includes(env as EClinicalWorksEnv);
}

class EClinicalWorksApi {
  private axiosFhirInstance: AxiosInstance;
  private baseFhirUrl: string;
  private practiceId: string;
  private token: string;

  private constructor(config: EClinicalWorksApiConfig) {
    this.practiceId = config.practiceId;
    this.baseFhirUrl = `https://${
      config.environment === "production" ? "" : "staging-"
    }fhir.ecwcloud.com`;
    this.axiosFhirInstance = axios.create({});
    this.token = config.authToken;
  }

  public static async create(config: EClinicalWorksApiConfig): Promise<EClinicalWorksApi> {
    const instance = new EClinicalWorksApi(config);
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
      `EClinicalWorks getPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
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
      ehr: EhrSources.eclinicalworks,
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

export default EClinicalWorksApi;
