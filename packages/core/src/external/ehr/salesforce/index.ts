import { NotFoundError } from "@metriport/shared";
import {
  PatientSOQL,
  patientSOQLSchema,
} from "@metriport/shared/interface/external/ehr/salesforce/patient";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosInstance } from "axios";
import { out } from "../../../util/log";
import { ApiConfig, makeRequest, MakeRequestParamsInEhr } from "../shared";
import { getObjectHandler, parsePatientId, SalesforcePatient } from "./object-handlers";

interface SalesforceApiConfig
  extends Omit<ApiConfig, "twoLeggedAuthTokenInfo" | "clientKey" | "clientSecret"> {
  environment: SalesforceEnv;
  authToken: string;
  instanceUrl: string;
}

const salesforceEnv = ["production", "staging"] as const;
const SALESFORCE_API_VERSION = "v64.0";

export type SalesforceEnv = (typeof salesforceEnv)[number];
export function isSalesforceEnv(env: string): env is SalesforceEnv {
  return salesforceEnv.includes(env as SalesforceEnv);
}

class SalesforceApi {
  private axiosInstanceProprietary: AxiosInstance;
  private baseUrl: string;
  private token: string;
  private practiceId: string;

  private constructor(config: SalesforceApiConfig) {
    this.practiceId = config.practiceId;
    this.baseUrl = config.instanceUrl;
    this.axiosInstanceProprietary = axios.create({});
    this.token = config.authToken;
  }

  public static async create(config: SalesforceApiConfig): Promise<SalesforceApi> {
    const instance = new SalesforceApi(config);
    await instance.initialize();
    return instance;
  }

  async initialize(): Promise<void> {
    this.axiosInstanceProprietary = axios.create({
      baseURL: `${this.baseUrl}`,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get patient from Salesforce using patient ID
   * Patient ID format: "contact_XXXXX" or "account_XXXXX"
   */
  async getPatient({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<SalesforcePatient> {
    const { debug } = out(
      `Salesforce getPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );

    const { objectType, id } = parsePatientId(patientId);
    const handler = getObjectHandler(objectType);

    const query = `SELECT ${handler
      .getSOQLFields()
      .join(", ")} FROM ${handler.getObjectType()} WHERE Id = '${id}'`;
    const patientGetUrl = `/services/data/${SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(
      query
    )}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };

    const salesforcePatient = await this.makeRequest<PatientSOQL>({
      cxId,
      patientId,
      s3Path: "patient",
      method: "GET",
      url: patientGetUrl,
      additionalInfo,
      schema: patientSOQLSchema,
      debug,
      emptyResponse: false,
    });

    const rawRecord = this.getPatientRecord(salesforcePatient, cxId, patientId);
    return handler.normalizeData(rawRecord);
  }

  private getPatientRecord(
    patient: PatientSOQL,
    cxId: string,
    patientId: string
  ): Record<string, unknown> {
    const [record] = patient.records;
    if (!record) throw new NotFoundError("Patient not found", undefined, { cxId, patientId });
    return record;
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
      ehr: EhrSources.salesforce,
      cxId,
      practiceId: this.practiceId,
      patientId,
      s3Path,
      axiosInstance: this.axiosInstanceProprietary,
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

export default SalesforceApi;
