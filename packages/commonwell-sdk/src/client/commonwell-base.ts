import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { Agent } from "https";
import { executeWithNetworkRetries, defaultOptionsRequestNotAccepted } from "@metriport/shared";
import httpStatus from "http-status";
import {
  APIMode,
  CommonWellOptions,
  DEFAULT_AXIOS_TIMEOUT_SECONDS,
  defaultOnError500,
  OnError500Options,
} from "./common";

/**
 * Implementation of the CommonWell API, v4.
 * @see https://www.commonwellalliance.org/specification/
 *
 * For the Organization management API (member API):
 * @see https://commonwellalliance.sharepoint.com/sites/CommonWellServicesPlatform/SitePages/Organization-APIs.aspx
 */
export class CommonWellBase {
  static integrationUrl = "https://api.integration.commonwellalliance.lkopera.com";
  static productionUrl = "https://api.commonwellalliance.lkopera.com";

  readonly api: AxiosInstance;
  protected rsaPrivateKey: string;
  private httpsAgent: Agent;
  private _lastTransactionId: string | undefined;
  protected onError500: OnError500Options;

  /**
   * Creates a new instance of the CommonWell API client pertaining to an
   * organization to make requests on behalf of.
   *
   * @param orgCert         The certificate (public key) for the organization.
   * @param rsaPrivateKey   An RSA key corresponding to the specified orgCert.
   * @param memberName      The name of the member.
   * @param memberId        The ID of the member (not the OID).
   * @param apiMode         The mode the client will be running.
   * @param options         Optional parameters
   * @param options.timeout Connection timeout in milliseconds, default 120 seconds.
   */
  constructor({
    orgCert,
    rsaPrivateKey,
    apiMode,
    options = {},
  }: {
    orgCert: string;
    rsaPrivateKey: string;
    apiMode: APIMode;
    options?: CommonWellOptions;
  }) {
    this.rsaPrivateKey = rsaPrivateKey;
    this.httpsAgent = new Agent({ cert: orgCert, key: rsaPrivateKey });
    this.onError500 = { ...defaultOnError500, ...(options.onError500 ?? {}) };
    this.api = axios.create({
      timeout: options?.timeout ?? DEFAULT_AXIOS_TIMEOUT_SECONDS * 1_000,
      baseURL:
        apiMode === APIMode.production
          ? CommonWellBase.productionUrl
          : CommonWellBase.integrationUrl,
      httpsAgent: this.httpsAgent,
    });
    if (options.preRequestHook) {
      this.api.interceptors.request.use(this.axiosPreRequest(this, options.preRequestHook));
    }
    this.api.interceptors.response.use(
      this.axiosSuccessfulResponse(this, options.postRequestHook),
      this.axiosErrorResponse(this, options.postRequestHook)
    );
  }

  /**
   * Returns the transaction ID from the last request.
   */
  get lastTransactionId(): string | undefined {
    return this._lastTransactionId;
  }

  private axiosPreRequest(
    _this: CommonWellBase,
    preRequestHook: CommonWellOptions["preRequestHook"]
  ) {
    return (reqConfig: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
      preRequestHook?.(reqConfig);
      return reqConfig;
    };
  }

  // Being extra safe with these bc a failure here fails the actual request
  private postRequest(response: AxiosResponse): void {
    this._lastTransactionId =
      response && response.headers ? response.headers["x-trace-id"] : undefined;
  }

  private axiosSuccessfulResponse(
    _this: CommonWellBase,
    postRequestHook?: CommonWellOptions["postRequestHook"]
  ) {
    return (response: AxiosResponse): AxiosResponse => {
      if (_this) _this.postRequest(response);
      postRequestHook?.(response);
      return response;
    };
  }

  private axiosErrorResponse(
    _this: CommonWellBase,
    postRequestHook?: CommonWellOptions["postRequestHook"]
  ) {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (error: any) => {
      const resp = error?.response as AxiosResponse | undefined;
      if (_this && resp) _this.postRequest(resp);
      if (resp) postRequestHook?.(resp);
      return Promise.reject(error);
    };
  }

  protected async executeWithRetriesOn500IfEnabled<T>(fn: () => Promise<T>): Promise<T> {
    return this.onError500.retry
      ? executeWithNetworkRetries(fn, {
          ...this.onError500,
          httpCodesToRetry: [...defaultOptionsRequestNotAccepted.httpCodesToRetry],
          httpStatusCodesToRetry: [
            ...defaultOptionsRequestNotAccepted.httpStatusCodesToRetry,
            httpStatus.INTERNAL_SERVER_ERROR,
            httpStatus.SERVICE_UNAVAILABLE,
          ],
        })
      : fn();
  }
}
