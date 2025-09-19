import {
  Patient as SalesforcePatient,
  PatientSOQL,
  patientSOQLSchema,
} from "@metriport/shared/interface/external/ehr/salesforce/patient";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosInstance } from "axios";
import { out } from "../../../util/log";
import { ApiConfig, makeRequest, MakeRequestParamsInEhr } from "../shared";

interface SalesforceApiConfig
  extends Omit<ApiConfig, "twoLeggedAuthTokenInfo" | "clientKey" | "clientSecret"> {
  environment: SalesforceEnv;
  authToken: string;
  instanceUrl: string;
  orgId: string;
}

const salesforceEnv = ["production", "staging"] as const;

export type SalesforceEnv = (typeof salesforceEnv)[number];
export function isSalesforceEnv(env: string): env is SalesforceEnv {
  return salesforceEnv.includes(env as SalesforceEnv);
}

class SalesforceApi {
  private axiosFhirInstance: AxiosInstance;
  private baseFhirUrl: string;
  private orgId: string;
  private token: string;

  private constructor(config: SalesforceApiConfig) {
    this.orgId = config.orgId;
    this.baseFhirUrl = config.instanceUrl;
    this.axiosFhirInstance = axios.create({});
    this.token = config.authToken;
  }

  public static async create(config: SalesforceApiConfig): Promise<SalesforceApi> {
    const instance = new SalesforceApi(config);
    await instance.initialize();
    return instance;
  }

  async initialize(): Promise<void> {
    this.axiosFhirInstance = axios.create({
      baseURL: `${this.baseFhirUrl}`,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });
  }

  async getPatient({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<SalesforcePatient> {
    const { debug } = out(
      `Salesforce getPatient - cxId ${cxId} orgId ${this.orgId} patientId ${patientId}`
    );
    const contactId = this.getPatientId(patientId);
    const query = `SELECT Id, FirstName, LastName, Email, Phone, MobilePhone, OtherPhone, MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry, Birthdate, GenderIdentity FROM Contact WHERE Id = '${contactId}'`;
    const patientGetUrl = `/services/data/v64.0/query?q=${query}`;
    const additionalInfo = { cxId, orgId: this.orgId, patientId };
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

    return this.getPatientRecord(salesforcePatient);
  }

  private getPatientRecord(patient: PatientSOQL): SalesforcePatient {
    const [record] = patient.records;
    if (!record) throw new Error("Patient not found");
    return record;
  }

  getPatientId(patientId: string): string {
    const [type, id] = patientId.split("_");
    if (type?.toLowerCase() === "contact") return `${id}`;
    throw new Error(`Invalid patient ID: ${patientId}`);
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
    const response = await makeRequest<T>({
      ehr: EhrSources.salesforce,
      cxId,
      practiceId: this.orgId,
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
    console.log("response ===>", response);
    return response;
  }
}

export default SalesforceApi;
