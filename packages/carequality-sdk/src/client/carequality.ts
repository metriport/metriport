import BadRequestError from "@metriport/core/util/error/bad-request";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { STU3Bundle, stu3BundleSchema } from "../models/bundle";
import { Organization } from "../models/organization";

dayjs.extend(duration);

const DEFAULT_AXIOS_TIMEOUT = dayjs.duration(120, "seconds");
const MAX_COUNT = 1000;
const JSON_FORMAT = "_format=json";

export enum APIMode {
  dev = "dev",
  staging = "stage",
}

/**
 * This SDK operates on FHIR STU3 format.
 */
export class Carequality {
  private static readonly devUrl = "https://dev-dir-ceq.sequoiadns.org/fhir-stu3/1.0.1";
  private static readonly stagingUrl = "https://stage-dir-ceq.sequoiaproject.org/fhir-stu3/1.0.1";

  // NOTE: These URLs can be used if we migrate to FHIR R4 format.
  // private static readonly devUrl = "https://directory.dev.carequality.org/fhir";
  // private static readonly  stagingUrl = "https://directory.stage.carequality.org/fhir";

  static ORG_ENDPOINT = "/Organization/";
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
   * Lists the indicated number of organizations. Mostly used for testing purposes.
   * @param count Optional, number of organizations to fetch.
   * @param start Optional, the index of the directory to start querying from; optional
   * @returns
   */
  async listOrganizations({
    count = MAX_COUNT,
    start = 0,
  }: {
    count?: number;
    start?: number;
  }): Promise<Organization[]> {
    if (count < 1 || count > MAX_COUNT)
      throw new BadRequestError(
        `Count value must be between 1 and ${MAX_COUNT}. If you need more, use listAllOrganizations()`
      );

    const url = `${Carequality.ORG_ENDPOINT}?apikey=${this.apiKey}&${JSON_FORMAT}&_count=${count}&_start=${start}`;
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
        console.log(
          `Querying the next ${MAX_COUNT} organizations, starting from ${currentPosition}`
        );
        const orgs = await this.listOrganizations({ start: currentPosition });
        organizations.push(...orgs);
        currentPosition += MAX_COUNT;

        const bundleEntryLength = orgs.length;
        console.log(
          `Received: ${bundleEntryLength} orgs. Continuing: ${!(bundleEntryLength < MAX_COUNT)}`
        );
        if (bundleEntryLength < MAX_COUNT) {
          console.log("Reached the end of the CQ directory...");
          isDone = true;
        }
      } catch (error) {
        isDone = true;
        const msg = "Failed to list CQ organizations";
        console.log(`${msg}. Cause: ${error}.`);
        if (!failGracefully) {
          throw new MetriportError(msg, error, {});
        }
      }
    }
    return organizations;
  }
}
