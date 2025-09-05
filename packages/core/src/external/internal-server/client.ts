import { MetriportError } from "@metriport/shared";
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { Config } from "../../util/config";

const isSandbox = Config.isSandbox();
const baseURL = Config.getInternalServerUrl();
/**
 * API client for internal server communication.
 */
export class InternalServerApi {
  protected readonly client: AxiosInstance;

  constructor() {
    // disabled in sandbox environment
    if (isSandbox) {
      this.client = axios.create({ baseURL: "http://localhost" });
      return;
    }
    if (!baseURL) {
      throw new MetriportError("INTERNAL_SERVER_BASE_URL not configured");
    }
    this.client = axios.create({
      baseURL,
      timeout: 20_000,
    });
  }

  async makeRequest<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    data?: unknown,
    additionalConfig?: AxiosRequestConfig
  ): Promise<T> {
    // disabled in sandbox environment
    if (isSandbox) return Promise.resolve({} as T);

    const response = await this.client.request({
      method,
      url: path,
      data,
      ...additionalConfig,
    });

    return response.data;
  }
}
