import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { Config } from "../../util/config";

/**
 * API client for internal server communication.
 */
export class InternalServerApi {
  protected readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: Config.getInternalServerUrl(),
      timeout: 20_000,
    });
  }

  async makeRequest<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    data?: unknown,
    additionalConfig?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.request({
      method,
      url: path,
      data,
      ...additionalConfig,
    });

    return response.data;
  }
}
