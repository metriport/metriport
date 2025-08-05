import { Bundle } from "@medplum/fhirtypes";
import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  APIMode,
  CarequalityManagementApi,
  ListOrganizationsParams,
  OrganizationWithId,
} from "./carequality";

dayjs.extend(duration);

const DEFAULT_AXIOS_TIMEOUT = dayjs.duration(120, "seconds");
const DEFAULT_MAXIMUM_BACKOFF = dayjs.duration(30, "seconds");
const BASE_DELAY = dayjs.duration(1, "seconds");
const MAX_COUNT = 5_000;
const DEFAULT_MAX_RETRIES = 3;
const JSON_FORMAT = "json";

/**
 * This SDK operates on FHIR R4 format.
 */
export class CarequalityManagementApiFhir implements CarequalityManagementApi {
  private static readonly devUrl = "https://directory.dev.carequality.org/fhir";
  private static readonly stagingUrl = "https://directory.stage.carequality.org/fhir";
  private static readonly productionUrl = "https://directory.prod.carequality.org/fhir";

  static ORG_ENDPOINT = "/Organization";
  readonly api: AxiosInstance;
  readonly apiKey: string;
  readonly maxBackoff: number;

  /**
   * Creates a new instance of the Carequality Management API client pertaining to an
   * organization to make requests on behalf of.
   *
   * @param apiKey                  The API key to use for authentication.
   * @param apiMode                 Optional, the mode the client will be running. Defaults to staging.
   * @param options                 Optional parameters
   * @param options.timeout         Connection timeout in milliseconds, defaults to 120 seconds.
   * @param options.retries         Number of retries for failed requests, defaults to 3.
   * @param options.maxBackoff      Number of seconds for the maximum backoff during retry requests, defaults to 30 seconds.
   */
  constructor({
    apiKey,
    apiMode = APIMode.production,
    options = {},
  }: {
    apiKey: string;
    apiMode: APIMode;
    options?: { timeout?: number; retries?: number; maxBackoff?: number };
  }) {
    let baseUrl;
    switch (apiMode) {
      case APIMode.dev:
        baseUrl = CarequalityManagementApiFhir.devUrl;
        break;
      case APIMode.staging:
        baseUrl = CarequalityManagementApiFhir.stagingUrl;
        break;
      case APIMode.production:
        baseUrl = CarequalityManagementApiFhir.productionUrl;
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

  private buildHeaders(headers?: Record<string, string>): Record<string, string> {
    return {
      ...headers,
      "Accept-Encoding": "gzip",
      "Content-Type": "application/json",
      Authorization: `api-key ${this.apiKey}`,
    };
  }

  private async sendGetRequest(
    url: string,
    headers?: Record<string, string>
  ): Promise<AxiosResponse> {
    return this.api.get(url, { headers: this.buildHeaders(headers) });
  }

  private async sendPutRequest(
    url: string,
    data: unknown,
    headers?: Record<string, string>
  ): Promise<AxiosResponse> {
    return this.api.put(url, data, { headers: this.buildHeaders(headers) });
  }

  private isNotFoundError(error: AxiosError): boolean {
    if (error.response && [404, 410].includes(error.response?.status)) return true;
    return false;
  }

  async getOrganization(oid: string): Promise<OrganizationWithId | undefined> {
    const query = new URLSearchParams();
    query.append("_format", JSON_FORMAT);
    const url = `${CarequalityManagementApiFhir.ORG_ENDPOINT}/${oid}?${query.toString()}`;
    try {
      const resp = await this.sendGetRequest(url);
      if (!resp.data) return undefined;
      return resp.data as OrganizationWithId;
    } catch (error) {
      if (error instanceof AxiosError && this.isNotFoundError(error)) return undefined;
      throw error;
    }
  }

  async listOrganizations({
    count = MAX_COUNT,
    start = 0,
    oid,
    active,
    sortKey = "_id",
  }: ListOrganizationsParams = {}): Promise<OrganizationWithId[]> {
    if (count < 1 || count > MAX_COUNT) {
      throw new Error(`Count value must be between 1 and ${MAX_COUNT}`);
    }
    const query = new URLSearchParams();
    query.append("_count", count.toString());
    query.append("_format", JSON_FORMAT);
    query.append("_sort", sortKey);
    start != undefined && query.append("_start", start.toString());
    oid != undefined && query.append("_id", oid);
    active != undefined && query.append("active", active.toString());

    const url = `${CarequalityManagementApiFhir.ORG_ENDPOINT}?${query.toString()}`;
    const resp = await this.sendGetRequest(url);
    const bundle = resp.data as Bundle;
    return (bundle.entry ?? []).flatMap(e => {
      const resource = e.resource;
      if (!resource || !resource.id || resource.resourceType !== "Organization") return [];
      return resource as OrganizationWithId;
    });
  }

  async registerOrganization(org: OrganizationWithId): Promise<OrganizationWithId> {
    const query = new URLSearchParams();
    query.append("_format", JSON_FORMAT);
    const url = `${CarequalityManagementApiFhir.ORG_ENDPOINT}/${org.id}?${query.toString()}`;
    const resp = await this.sendPutRequest(url, org);
    return resp.data;
  }

  async updateOrganization(org: OrganizationWithId): Promise<OrganizationWithId> {
    const query = new URLSearchParams();
    query.append("_format", JSON_FORMAT);
    const url = `${CarequalityManagementApiFhir.ORG_ENDPOINT}/${org.id}?${query.toString()}`;
    const resp = await this.sendPutRequest(url, org);
    return resp.data;
  }

  /**
   * Marks an organization as inactive in the Carequality directory.
   * The API doesn't support DELETE, so we need to send an update to disable it.
   * The API doesn't support PATCH operations, so we need to load the Org and then update it.
   * @param oid the OID of the organization to delete
   * @returns the organization with the active flag set to false
   */
  async deleteOrganization(oid: string): Promise<OrganizationWithId>;
  /**
   * Marks an organization as inactive in the Carequality directory.
   * The API doesn't support DELETE, so we need to send an update to disable it.
   * The API doesn't support PATCH operations, so issue a PUT instead.
   * @param org the organization to delete
   * @returns the organization with the active flag set to false
   */
  async deleteOrganization(org: OrganizationWithId): Promise<OrganizationWithId>;
  async deleteOrganization(oidOrOrg: string | OrganizationWithId): Promise<OrganizationWithId> {
    if (typeof oidOrOrg === "string") {
      const org = await this.getOrganization(oidOrOrg);
      if (!org) throw new Error(`Organization with OID ${oidOrOrg} not found`);
      org.active = false;
      return this.updateOrganization(org);
    }
    const org: OrganizationWithId = oidOrOrg;
    org.active = false;
    return this.updateOrganization(org);
  }
}
