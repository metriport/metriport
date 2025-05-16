import { Patient, patientSchema } from "@metriport/shared/interface/external/ehr/patient";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosInstance } from "axios";
import { out } from "../../../util/log";
import { ApiConfig, makeRequest, MakeRequestParamsInEhr } from "../shared";

interface EclinicalworksApiConfig
  extends Omit<ApiConfig, "twoLeggedAuthTokenInfo" | "clientKey" | "clientSecret"> {
  environment: EclinicalworksEnv;
  authToken: string;
  fhirUrl: string;
}

const eclinicalworksEnv = ["production", "staging"] as const;

export type EclinicalworksEnv = (typeof eclinicalworksEnv)[number];
export function isEclinicalworksEnv(env: string): env is EclinicalworksEnv {
  return eclinicalworksEnv.includes(env as EclinicalworksEnv);
}

class EclinicalworksApi {
  private axiosFhirInstance: AxiosInstance;
  private fhirUrl: string;
  private practiceId: string;
  private token: string;

  private constructor(config: EclinicalworksApiConfig) {
    this.practiceId = config.practiceId;
    this.fhirUrl = config.fhirUrl;
    this.axiosFhirInstance = axios.create({});
    this.token = config.authToken;
  }

  public static async create(config: EclinicalworksApiConfig): Promise<EclinicalworksApi> {
    const instance = new EclinicalworksApi(config);
    await instance.initialize();
    return instance;
  }

  async initialize(): Promise<void> {
    this.axiosFhirInstance = axios.create({
      baseURL: this.fhirUrl,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }

  async getPatient({ cxId, patientId }: { cxId: string; patientId: string }): Promise<Patient> {
    const { debug } = out(
      `Eclinicalworks getPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
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

export default EclinicalworksApi;
