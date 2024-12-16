import { Bundle, Organization } from "@medplum/fhirtypes";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Agent } from "https";
import { APIMode } from "../models/shared";
import {
  CarequalityManagementAPIFhir,
  ListOrganizationsParams,
  UpdateOrganizationParams,
} from "./carequality-fhir-api";

dayjs.extend(duration);

const DEFAULT_AXIOS_TIMEOUT = dayjs.duration(120, "seconds");
const DEFAULT_MAXIMUM_BACKOFF = dayjs.duration(30, "seconds");
const BASE_DELAY = dayjs.duration(1, "seconds");
const MAX_COUNT = 1000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * This SDK operates on FHIR R4 format.
 */
export class CarequalityManagementAPIImplFhir implements CarequalityManagementAPIFhir {
  private static readonly devUrl = "https://directory.dev.carequality.org/fhir";
  private static readonly stagingUrl = "https://directory.stage.carequality.org/fhir";
  private static readonly productionUrl = "https://directory.prod.carequality.org/fhir";

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
        baseUrl = CarequalityManagementAPIImplFhir.devUrl;
        break;
      case APIMode.staging:
        baseUrl = CarequalityManagementAPIImplFhir.stagingUrl;
        break;
      case APIMode.production:
        baseUrl = CarequalityManagementAPIImplFhir.productionUrl;
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

    // TODO: #1536 - improved retry logic. Issue: https://github.com/metriport/metriport-internal/issues/1536
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
      "Content-Type": "application/json",
      Authorization: `api-key ${this.apiKey}`,
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
   * Returns a single organization.
   *
   * @param oid Optional, the OID of the organization to fetch.
   * @returns
   */
  async getOrganization(oid: string): Promise<Organization> {
    const url = `${CarequalityManagementAPIImplFhir.ORG_ENDPOINT}/${oid}`;
    const resp = await this.sendGetRequest(url);
    return resp.data as Organization;
  }

  /**
   * Lists the indicated number of organizations.
   *
   * @param count Optional, number of organizations to fetch. Defaults to 1000.
   * @param start Optional, the index of the directory to start querying from. Defaults to 0.
   * @param oid Optional, the OID of the organization to fetch.
   * @param active Optional, indicates whether to list active or inactive organizations. Defaults to true.
   * @returns
   */
  async listOrganizations({
    count = MAX_COUNT,
    start = 0,
    oid,
    active,
  }: ListOrganizationsParams = {}): Promise<Organization[]> {
    if (count < 1 || count > MAX_COUNT) {
      throw new Error(`Count value must be between 1 and ${MAX_COUNT}`);
    }
    const query = new URLSearchParams();
    query.append("_count", count.toString());
    start != undefined && query.append("_start", start.toString());
    oid != undefined && query.append("_id", oid);
    active != undefined && query.append("active", active.toString());

    const url = `${CarequalityManagementAPIImplFhir.ORG_ENDPOINT}?${query.toString()}`;
    const resp = await this.sendGetRequest(url);
    const bundle = resp.data as Bundle;
    return (bundle.entry ?? []).map(e => e.resource as Organization);
  }

  /**
   * Registers an organization with the Carequality directory.
   *
   * @param org string containing the organization resource (in XML format)
   * @returns an XML string containing an OperationOutcome resource - see Carequality documentation for details - https://carequality.org/healthcare-directory/OperationOutcome-create-success-example2.xml.html
   */
  async registerOrganization(org: Organization): Promise<Organization> {
    const query = new URLSearchParams();

    const url = `${CarequalityManagementAPIImplFhir.ORG_ENDPOINT}?${query.toString()}`;
    const resp = await this.sendPostRequest(url, org);
    return resp.data;
  }

  /**
   * Updates an organization with the Carequality directory.
   *
   * @param org string containing the organization resource (in XML format)
   * @param oid string containing the organization OID
   * @returns an XML string containing an OperationOutcome resource - see Carequality documentation for details - https://carequality.org/healthcare-directory/OperationOutcome-create-success-example2.xml.html
   */
  async updateOrganization({ org, oid }: UpdateOrganizationParams): Promise<Organization> {
    const query = new URLSearchParams();

    const url = `${CarequalityManagementAPIImplFhir.ORG_ENDPOINT}/${oid}?${query.toString()}`;
    const resp = await this.sendPutRequest(url, org);
    return resp.data;
  }
}
