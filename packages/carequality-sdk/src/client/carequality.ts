import BadRequestError from "@metriport/core/util/error/bad-request";
import axios, { AxiosInstance, AxiosResponse, AxiosStatic } from "axios";
import { Bundle as Stu3Bundle, bundleSchema } from "../models/bundle";
import { OrganizationList } from "../models/organization";

const DEFAULT_AXIOS_TIMEOUT_SECONDS = 120;
const MAX_COUNT = 1000;
const JSON_FORMAT = "_format=json";

export enum APIMode {
  dev = "dev",
  staging = "stage",
}

export type Options = {
  axios?: AxiosStatic; // Set axios if it fails to load
  timeout?: number;
};

/**
 * Currently operates on FHIR Stu3 format.
 */
export class Carequality {
  static devUrl = "https://dev-dir-ceq.sequoiadns.org/fhir-stu3/1.0.1";
  static stagingUrl = "https://stage-dir-ceq.sequoiaproject.org/fhir-stu3/1.0.1";

  // NOTE: These URLs can be used if we migrate to FHIR R4 format.
  // static devUrl = "https://directory.dev.carequality.org/fhir";
  // static stagingUrl = "https://directory.stage.carequality.org/fhir";

  static ORG_ENDPOINT = "/Organization/";
  readonly api: AxiosInstance;
  readonly apiKey: string;

  /**
   * Creates a new instance of the CommonWell API client pertaining to an
   * organization to make requests on behalf of.
   *
   * @param apiKey          The API key to use for authentication.
   * @param apiMode         The mode the client will be running.
   * @param options         Optional parameters
   * @param options.timeout Connection timeout in milliseconds, default 120 seconds.
   */
  constructor(apiKey: string, apiMode: string, options: Options = {}) {
    this.api = axios.create({
      timeout: options?.timeout ?? DEFAULT_AXIOS_TIMEOUT_SECONDS * 1_000,
      baseURL: apiMode === APIMode.dev ? Carequality.devUrl : Carequality.stagingUrl,
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
   * Lists the indicated number of organizations. Mostly used for testing purposes.
   * @param count number of organizations to fetch
   * @returns
   */
  async listOrganizations(count: number): Promise<OrganizationList> {
    if (count < 1 || count > 1000)
      throw new BadRequestError(
        "Count value must be between 1 and 1000. If you need more, use listDirectories()"
      );
    const resp = await this.sendGetRequest(
      `${Carequality.ORG_ENDPOINT}?apikey=${this.apiKey}&${JSON_FORMAT}&_count=${count}`,
      { "Content-Type": "application/json" }
    );

    const bundle: Stu3Bundle = bundleSchema.parse(resp.data.Bundle);
    const orgs = bundle.entry.map(e => e.resource.Organization);

    return {
      count: bundle.total.value,
      organizations: orgs,
    };
  }

  /**
   * Lists the whole Carequality directory.
   *
   * @returns organizations list and count
   */
  async listAllOrganizations(): Promise<OrganizationList> {
    let start = 0;
    const baseUrl = `${Carequality.ORG_ENDPOINT}?apikey=${this.apiKey}&${JSON_FORMAT}&_count=${MAX_COUNT}`;
    const results: OrganizationList = {
      count: 0,
      organizations: [],
    };
    let isDone = false;

    while (!isDone) {
      const url = baseUrl + `&_start=${start}`;
      try {
        const resp = await this.sendGetRequest(url);
        const bundle = bundleSchema.parse(resp.data.Bundle);
        const organs = bundle.entry.map(e => e.resource.Organization);
        results.organizations.push(...organs);
        results.count += bundle.total.value;
        start += MAX_COUNT;

        const bundleEntryLength = resp.data.Bundle.entry.length;
        if (bundleEntryLength <= MAX_COUNT / 2) {
          console.log("Reached the end of the CQ directory...");
          isDone = true;
        }
      } catch (error) {
        console.log(`Failed to list CQ organizations. Cause: ${error}.`);
        isDone = true;
      }
    }
    return results;
  }
}
