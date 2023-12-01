import BadRequestError from "@metriport/core/util/error/bad-request";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { STU3Bundle, stu3BundleSchema } from "../models/bundle";
import { Organization } from "../models/organization";
import { CarequalityAPI } from "./carequality-api";

dayjs.extend(duration);

const DEFAULT_AXIOS_TIMEOUT = dayjs.duration(120, "seconds");
const MAX_COUNT = 1000;
const JSON_FORMAT = "json";
const XML_FORMAT = "xml";

export enum APIMode {
  dev = "dev",
  staging = "stage",
}

/**
 * This SDK operates on FHIR STU3 format.
 */
export class Carequality implements CarequalityAPI {
  private static readonly devUrl = "https://dev-dir-ceq.sequoiadns.org/fhir-stu3/1.0.1";
  private static readonly stagingUrl = "https://stage-dir-ceq.sequoiaproject.org/fhir-stu3/1.0.1";

  // NOTE: These URLs can be used if we migrate to FHIR R4 format.
  // private static readonly devUrl = "https://directory.dev.carequality.org/fhir";
  // private static readonly  stagingUrl = "https://directory.stage.carequality.org/fhir";

  static ORG_ENDPOINT = "/Organization";
  readonly api: AxiosInstance;
  readonly apiKey: string;

  /**
   * Creates a new instance of the Carequality API client pertaining to an
   * organization to make requests on behalf of.
   *
   * @param apiKey          The API key to use for authentication.
   * @param apiMode         Optional, the mode the client will be running. Defaults to staging.
   * @param options         Optional parameters
   * @param options.timeout Connection timeout in milliseconds, default 120 seconds.
   */
  constructor(
    apiKey: string,
    apiMode: APIMode = APIMode.staging,
    options: { timeout?: number } = {}
  ) {
    let baseUrl;

    switch (apiMode) {
      case APIMode.dev:
        baseUrl = Carequality.devUrl;
        break;
      case APIMode.staging:
        baseUrl = Carequality.stagingUrl;
        break;
      default:
        throw new Error("API mode not supported.");
    }

    this.api = axios.create({
      timeout: options?.timeout ?? DEFAULT_AXIOS_TIMEOUT.asMilliseconds(),
      baseURL: baseUrl,
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
      throw new BadRequestError(
        `Count value must be between 1 and ${MAX_COUNT}. If you need more, use listAllOrganizations()`
      );
    const query = new URLSearchParams();
    query.append("apikey", this.apiKey);
    query.append("_format", JSON_FORMAT);
    query.append("_count", count.toString());
    query.append("_start", start.toString());
    oid && query.append("_id", oid);
    const queryString = query.toString();

    const url = `${Carequality.ORG_ENDPOINT}?${queryString}`;
    const resp = await this.sendGetRequest(url, { "Content-Type": "application/json" });
    const bundle: STU3Bundle = stu3BundleSchema.parse(resp.data.Bundle);
    const orgs = bundle.entry.map(e => e.resource.Organization);

    return orgs;
  }

  /**
   * Lists the whole Carequality directory.
   *
   * @returns organizations list and count
   */
  async listAllOrganizations(failGracefully = false): Promise<Organization[]> {
    let currentPosition = 0;
    const organizations = [];
    let isDone = false;

    while (!isDone) {
      try {
        const orgs = await this.listOrganizations({ start: currentPosition });
        organizations.push(...orgs);
        currentPosition += MAX_COUNT;

        const bundleEntryLength = orgs.length;
        if (bundleEntryLength < MAX_COUNT) {
          isDone = true;
        }
      } catch (error) {
        isDone = true;
        if (!failGracefully) {
          throw new MetriportError("Failed to list CQ organizations", error, {});
        }
      }
    }
    return organizations;
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

    const url = `${Carequality.ORG_ENDPOINT}?${query.toString()}`;
    const resp = await this.api.post(url, org, {
      headers: { "Content-Type": "text/xml" },
    });
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

    const url = `${Carequality.ORG_ENDPOINT}/${oid}?${query.toString()}`;
    const resp = await this.api.put(url, org, {
      headers: { "Content-Type": "application/xml" },
    });
    return resp.data;
  }
}
