import axios, { AxiosInstance, AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Agent } from "https";
import { STU3Bundle, stu3BundleSchema } from "../models/bundle";
import { Organization } from "../models/organization";
import { CarequalityManagementAPI } from "./carequality-api";

dayjs.extend(duration);

const DEFAULT_AXIOS_TIMEOUT = dayjs.duration(120, "seconds");
const DEFAULT_MAXIMUM_BACKOFF = dayjs.duration(30, "seconds");
const BASE_DELAY = dayjs.duration(1, "seconds");
const MAX_COUNT = 1000;
const JSON_FORMAT = "json";
const XML_FORMAT = "xml";
const DEFAULT_MAX_RETRIES = 3;

export enum APIMode {
  dev = "dev",
  staging = "stage",
  production = "production",
}

/**
 * This SDK operates on FHIR STU3 format.
 */
export class CarequalityManagementAPIImpl implements CarequalityManagementAPI {
  private static readonly devUrl = "https://directory.dev.carequality.org/fhir-pre-stu3/";
  private static readonly stagingUrl = "https://stage-dir-ceq.sequoiaproject.org/fhir-stu3/1.0.1";
  private static readonly productionUrl =
    "https://prod-dir-ceq-01.sequoiaproject.org/fhir-stu3/1.0.1/";

  static ORG_ENDPOINT = "/Organization";
  readonly api: AxiosInstance;
  readonly apiKey: string;
  readonly maxBackoff: number;
  private httpsAgent: Agent;

  /**
   * Creates a new instance of the Carequality Management API client pertaining to an
   * organization to make requests on behalf of.
   *
   * @param orgCert                 The certificate (public key) for the organization.
   * @param rsaPrivateKey           An RSA key corresponding to the specified orgCert.
   * @param rsaPrivateKeyPassword   The password to decrypt the private key.
   * @param apiKey                  The API key to use for authentication.
   * @param apiMode                 Optional, the mode the client will be running. Defaults to staging.
   * @param options                 Optional parameters
   * @param options.timeout         Connection timeout in milliseconds, defaults to 120 seconds.
   * @param options.retries         Number of retries for failed requests, defaults to 3.
   * @param options.maxBackoff      Number of seconds for the maximum backoff during retry requests, defaults to 30 seconds.
   */
  constructor({
    orgCert,
    rsaPrivateKey,
    rsaPrivateKeyPassword,
    apiKey,
    apiMode = APIMode.production,
    options = {},
  }: {
    orgCert: string;
    rsaPrivateKey: string;
    rsaPrivateKeyPassword: string;
    apiKey: string;
    apiMode: APIMode;
    options?: { timeout?: number; retries?: number; maxBackoff?: number };
  }) {
    this.httpsAgent = new Agent({
      cert: orgCert,
      key: rsaPrivateKey,
      passphrase: rsaPrivateKeyPassword,
    });
    let baseUrl;

    switch (apiMode) {
      case APIMode.dev:
        baseUrl = CarequalityManagementAPIImpl.devUrl;
        break;
      case APIMode.staging:
        baseUrl = CarequalityManagementAPIImpl.stagingUrl;
        break;
      case APIMode.production:
        baseUrl = CarequalityManagementAPIImpl.productionUrl;
        break;
      default:
        throw new Error("API mode not supported.");
    }
    this.maxBackoff = options?.maxBackoff
      ? dayjs.duration(options.maxBackoff, "seconds").asMilliseconds()
      : DEFAULT_MAXIMUM_BACKOFF.asMilliseconds();

    this.api = axios.create({
      timeout: options?.timeout ?? DEFAULT_AXIOS_TIMEOUT.asMilliseconds(),
      baseURL: baseUrl,
      httpsAgent: this.httpsAgent,
    });

    axiosRetry(this.api, {
      retries: options?.retries ?? DEFAULT_MAX_RETRIES,
      retryDelay: retryCount => {
        const exponentialDelay = Math.pow(2, Math.max(0, retryCount - 1));
        const jitter = Math.random();
        const delayWithJitter = (exponentialDelay + jitter) * BASE_DELAY.asMilliseconds();
        return Math.min(delayWithJitter, this.maxBackoff);
      },
      retryCondition: error => {
        return error.response?.status !== 200 && error.response?.status !== 403; // As per the Carequality Implementation Guide: https://carequality.org/healthcare-directory/operational_best_practices.html#reliability
      },
    });

    this.apiKey = apiKey;
  }

  buildHeaders(headers?: Record<string, string>): Record<string, string> {
    return {
      ...headers,
      "Accept-Encoding": "gzip",
    };
  }

  async sendGetRequest(url: string, headers?: Record<string, string>): Promise<AxiosResponse> {
    return this.api.get(url, { headers: this.buildHeaders(headers) });
  }

  async sendPostRequest(
    url: string,
    data: unknown,
    headers?: Record<string, string>
  ): Promise<AxiosResponse> {
    return this.api.post(url, data, { headers: this.buildHeaders(headers) });
  }

  async sendPutRequest(
    url: string,
    data: unknown,
    headers?: Record<string, string>
  ): Promise<AxiosResponse> {
    return this.api.put(url, data, { headers: this.buildHeaders(headers) });
  }

  /**
   * Lists the indicated number of organizations.
   *
   * @param count Optional, number of organizations to fetch. Defaults to 1000.
   * @param start Optional, the index of the directory to start querying from. Defaults to 0.
   * @param oid Optional, the OID of the organization to fetch.
   * @returns
   */
  async listOrganizations({
    count = MAX_COUNT,
    start = 0,
    oid,
  }: {
    count?: number;
    start?: number;
    oid?: string;
  }): Promise<Organization[]> {
    if (count < 1 || count > MAX_COUNT)
      throw new Error(`Count value must be between 1 and ${MAX_COUNT}`);
    const query = new URLSearchParams();
    query.append("apikey", this.apiKey);
    query.append("_format", JSON_FORMAT);
    query.append("_count", count.toString());
    query.append("_start", start.toString());
    oid && query.append("_id", oid);
    const queryString = query.toString();

    const url = `${CarequalityManagementAPIImpl.ORG_ENDPOINT}?${queryString}`;
    const resp = await this.sendGetRequest(url, { "Content-Type": "application/json" });
    const bundle: STU3Bundle = stu3BundleSchema.parse(resp.data.Bundle);
    const orgs = bundle.entry.map(e => e.resource.Organization);
    return orgs;
  }

  /**
   * Registers an organization with the Carequality directory.
   *
   * @param org string containing the organization resource (in XML format)
   * @returns an XML string containing an OperationOutcome resource - see Carequality documentation for details - https://carequality.org/healthcare-directory/OperationOutcome-create-success-example2.xml.html
   */
  async registerOrganization(org: string): Promise<string> {
    const query = new URLSearchParams();
    query.append("apikey", this.apiKey);
    query.append("_format", XML_FORMAT);

    const url = `${CarequalityManagementAPIImpl.ORG_ENDPOINT}?${query.toString()}`;
    const resp = await this.sendPostRequest(url, org, { "Content-Type": "text/xml" });
    return resp.data;
  }

  /**
   * Updates an organization with the Carequality directory.
   *
   * @param org string containing the organization resource (in XML format)
   * @param oid string containing the organization OID
   * @returns an XML string containing an OperationOutcome resource - see Carequality documentation for details - https://carequality.org/healthcare-directory/OperationOutcome-create-success-example2.xml.html
   */
  async updateOrganization(org: string, oid: string): Promise<string> {
    const query = new URLSearchParams();
    query.append("apikey", this.apiKey);
    query.append("_format", XML_FORMAT);

    const url = `${CarequalityManagementAPIImpl.ORG_ENDPOINT}/${oid}?${query.toString()}`;
    const resp = await this.sendPutRequest(url, org, { "Content-Type": "application/xml" });
    return resp.data;
  }
}
