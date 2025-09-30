import { MetriportError, NotFoundError } from "@metriport/shared";
import {
  PatientSOQL,
  patientSOQLSchema,
  Patient as EpicPatient,
} from "@metriport/shared/interface/external/ehr/epic/patient";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosInstance } from "axios";
import { out } from "../../../util/log";
import { ApiConfig, makeRequest, MakeRequestParamsInEhr } from "../shared";

interface EpicApiConfig
  extends Omit<ApiConfig, "twoLeggedAuthTokenInfo" | "clientKey" | "clientSecret"> {
  environment: EpicEnv;
  authToken: string;
  instanceUrl: string;
}

// TBD!  =======

const epicEnv = ["production", "staging"] as const;
const EPIC_API_VERSION = "R4";

export type EpicEnv = (typeof epicEnv)[number];
export function isEpicEnv(env: string): env is EpicEnv {
  return epicEnv.includes(env as EpicEnv);
}

class EpicApi {
  private axiosInstanceProprietary: AxiosInstance;
  private baseUrl: string;
  private token: string;
  private practiceId: string;

  private constructor(config: EpicApiConfig) {
    this.practiceId = config.practiceId;
    this.baseUrl = config.instanceUrl;
    this.axiosInstanceProprietary = axios.create({});
    this.token = config.authToken;
  }

  public static async create(config: EpicApiConfig): Promise<EpicApi> {
    const instance = new EpicApi(config);
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

  async getPatientFromContact({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<EpicPatient> {
    const { debug } = out(
      `Epic getPatientFromContact - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );

    const CONTACT_FIELDS = [
      "Id",
      "FirstName",
      "LastName",
      "Email",
      "Phone",
      "MobilePhone",
      "OtherPhone",
      "MailingStreet",
      "MailingCity",
      "MailingState",
      "MailingPostalCode",
      "MailingCountry",
      "Birthdate",
      "GenderIdentity",
    ] as const;

    const contactId = this.getPatientId(patientId);
    const query = `SELECT ${CONTACT_FIELDS.join(", ")} FROM Contact WHERE Id = '${contactId}'`;
    const patientGetUrl = `/services/data/${EPIC_API_VERSION}/query?q=${encodeURIComponent(query)}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const epicPatient = await this.makeRequest<PatientSOQL>({
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

    return this.getPatientRecord(epicPatient, cxId, patientId);
  }

  private getPatientRecord(patient: PatientSOQL, cxId: string, patientId: string): EpicPatient {
    const [record] = patient.records;
    if (!record) throw new NotFoundError("Patient not found", undefined, { cxId, patientId });
    return record;
  }

  getPatientId(patientId: string): string {
    const [type, id] = patientId.split("_");
    if (type?.toLowerCase() !== "contact") {
      throw new MetriportError("Invalid patient ID prefix", undefined, { patientId });
    }
    // Epic IDs are 15 or 18 alphanumeric characters
    const isValidId = typeof id === "string" && /^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/.test(id);
    if (!isValidId) {
      throw new MetriportError("Invalid Epic ID format", undefined, { patientId });
    }
    return id;
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
      ehr: EhrSources.epic,
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

export default EpicApi;
