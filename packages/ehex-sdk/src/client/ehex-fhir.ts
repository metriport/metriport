import { Bundle } from "@medplum/fhirtypes";
import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import https from "https";
import tls from "tls";
import { OrganizationWithId } from "../models/organization";
import {
  APIMode,
  EhexManagementApi,
  Link,
  ListOrganizationsParams,
  ListOrganizationsResponse,
} from "./ehex";

dayjs.extend(duration);

const DEFAULT_AXIOS_TIMEOUT = dayjs.duration(120, "seconds");
const DEFAULT_MAXIMUM_BACKOFF = dayjs.duration(30, "seconds");
const BASE_DELAY = dayjs.duration(1, "seconds");
const MAX_COUNT = 5_000;
const DEFAULT_MAX_RETRIES = 3;
const JSON_FORMAT = "json";
const HUB_AWARE_PARAM = "$hub-aware";

/**
 * This SDK operates on FHIR R4 format.
 */
export class EhexManagementApiFhir implements EhexManagementApi {
  private static readonly devUrl = "https://directory.val.ehealthexchange.org/fhir";
  private static readonly stagingUrl = "https://directory.val.ehealthexchange.org/fhir";
  private static readonly productionUrl = "https://directory.prd.ehealthexchange.org/fhir";

  static ORG_ENDPOINT = "/Organization";
  readonly api: AxiosInstance;
  readonly apiKey: string;
  readonly maxBackoff: number;

  /**
   * Creates a new instance of the Ehex Management API client pertaining to an
   * organization to make requests on behalf of.
   *
   * @param apiKey                  The API key to use for authentication.
   * @param apiMode                 The mode the client will be running.
   * @param options                 Optional parameters
   * @param options.timeout         Connection timeout in milliseconds, defaults to 120 seconds.
   * @param options.retries         Number of retries for failed requests, defaults to 3.
   * @param options.maxBackoff      Number of seconds for the maximum backoff during retry requests, defaults to 30 seconds.
   * @param options.caTrustBundle   Optional CA certificate(s) in PEM format. If provided, combines with default root certificates.
   */
  constructor({
    apiKey,
    apiMode,
    options = {},
  }: {
    apiKey: string;
    apiMode: APIMode;
    options?: {
      timeout?: number;
      retries?: number;
      maxBackoff?: number;
      caTrustBundle?: string;
    };
  }) {
    let baseUrl;
    switch (apiMode) {
      case APIMode.dev:
        baseUrl = EhexManagementApiFhir.devUrl;
        break;
      case APIMode.staging:
        baseUrl = EhexManagementApiFhir.stagingUrl;
        break;
      case APIMode.production:
        baseUrl = EhexManagementApiFhir.productionUrl;
        break;
      default:
        throw new Error("API mode not supported.");
    }
    this.maxBackoff = options?.maxBackoff
      ? dayjs.duration(options.maxBackoff, "seconds").asMilliseconds()
      : DEFAULT_MAXIMUM_BACKOFF.asMilliseconds();

    const httpsAgent = options?.caTrustBundle
      ? new https.Agent({
          rejectUnauthorized: true,
          ca: combineTrustStores(options.caTrustBundle),
        })
      : undefined;

    this.api = axios.create({
      timeout: options?.timeout ?? DEFAULT_AXIOS_TIMEOUT.asMilliseconds(),
      baseURL: baseUrl,
      ...(httpsAgent && { httpsAgent }),
    });

    // TODO: #1536 - improved retry logic.
    axiosRetry(this.api, {
      retries: options?.retries ?? DEFAULT_MAX_RETRIES,
      retryDelay: retryCount => {
        const exponentialDelay = Math.pow(2, Math.max(0, retryCount - 1));
        const jitter = Math.random();
        const delayWithJitter = (exponentialDelay + jitter) * BASE_DELAY.asMilliseconds();
        return Math.min(delayWithJitter, this.maxBackoff);
      },
      retryCondition: error => {
        // TODO: 1582 - Verify these status codes when we have access to the directory.
        return error.response?.status !== 200 && error.response?.status !== 403; // As per the Ehex Implementation Guide: https://sequoiaproject.org/SequoiaProjectHealthcareDirectoryImplementationGuide/output/toc.html
      },
    });

    this.apiKey = apiKey;
  }

  private isNotFoundError(error: AxiosError): boolean {
    if (error.response && [404, 410].includes(error.response?.status)) return true;
    return false;
  }

  async getOrganization(oid: string, isHubAware = false): Promise<OrganizationWithId | undefined> {
    const query = new URLSearchParams();
    query.append("_format", JSON_FORMAT);
    query.append("_apiKey", this.apiKey);
    const orgEndpoint = EhexManagementApiFhir.ORG_ENDPOINT;
    const hubAwarePath = isHubAware ? `/${HUB_AWARE_PARAM}` : "";
    const queryString = query.toString();
    const url = `${orgEndpoint}${hubAwarePath}/${oid}?${queryString}`;
    try {
      const resp = await this.api.get(url);
      if (!resp.data) return undefined;
      return resp.data as OrganizationWithId;
    } catch (error) {
      if (error instanceof AxiosError && this.isNotFoundError(error)) return undefined;
      throw error;
    }
  }

  async listOrganizations({
    count = MAX_COUNT,
    oid,
    active,
    sortKey,
    url,
    isHubAware = false,
  }: ListOrganizationsParams = {}): Promise<ListOrganizationsResponse> {
    const query = new URLSearchParams();
    query.append("_apiKey", this.apiKey);

    if (url) {
      const fullUrl = `${url}&${query.toString()}`;
      const resp = await this.api.get(fullUrl);
      return getListOrganizationsResponseFromAxiosResponse(resp);
    }

    query.append("_format", JSON_FORMAT);
    query.append("_count", count?.toString() ?? MAX_COUNT.toString());
    query.append("_sort", sortKey ?? "_id");
    oid != undefined && query.append("_id", oid);
    active != undefined && query.append("active", active.toString());

    const orgEndpoint = EhexManagementApiFhir.ORG_ENDPOINT;
    const hubAwarePath = isHubAware ? `/${HUB_AWARE_PARAM}` : "";
    const queryString = query.toString();
    const startingUrl = `${orgEndpoint}${hubAwarePath}?${queryString}`;
    const resp = await this.api.get(startingUrl);
    return getListOrganizationsResponseFromAxiosResponse(resp);
  }
}

function getLinkFromBundle(bundle: Bundle): Link | undefined {
  if (!bundle.link) return undefined;
  return {
    self: bundle.link?.find(link => link.relation === "self")?.url ?? "", // self should always be present according to the FHIR specification
    last: bundle.link?.find(link => link.relation === "last")?.url ?? "", // last should always be present according to the FHIR specification
    first: bundle.link?.find(link => link.relation === "first")?.url ?? "", // first should always be present according to the FHIR specification
    next: bundle.link?.find(link => link.relation === "next")?.url ?? undefined, // next is optional
    previous: bundle.link?.find(link => link.relation === "previous")?.url ?? undefined, // previous is optional
  };
}

function getListOrganizationsResponseFromAxiosResponse(
  resp: AxiosResponse
): ListOrganizationsResponse {
  const bundle = resp.data as Bundle;
  const link = getLinkFromBundle(bundle);
  if (!link) throw new Error("Link not found in bundle");
  return {
    organizations: bundle.entry?.map(e => e.resource as OrganizationWithId) ?? [],
    count: bundle.total ?? 0,
    link,
  };
}

/**
 * Combines the default Node.js root certificates with the custom trust store.
 * This ensures that both system-trusted CAs and custom CAs (like self-signed
 * certificates used by eHex gateways) are trusted.
 */
function combineTrustStores(customTrustStore: string): string {
  const defaultRootCerts = tls.rootCertificates.join("\n");
  return `${defaultRootCerts}\n${customTrustStore}`;
}
