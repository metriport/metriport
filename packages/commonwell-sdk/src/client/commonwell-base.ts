import { BadRequestError, MetriportError } from "@metriport/shared";
import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
  isAxiosError,
} from "axios";
import httpStatus from "http-status";
import { Agent } from "https";
import { APIMode, CommonWellOptions, DEFAULT_AXIOS_TIMEOUT_SECONDS } from "./common";

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
    this.api = axios.create({
      timeout: options?.timeout ?? DEFAULT_AXIOS_TIMEOUT_SECONDS * 1_000,
      baseURL:
        apiMode === APIMode.production
          ? CommonWellBase.productionUrl
          : CommonWellBase.integrationUrl,
      httpsAgent: this.httpsAgent,
    });
    options.preRequestHook &&
      this.api.interceptors.request.use(this.axiosPreRequest(this, options.preRequestHook));
    this.api.interceptors.response.use(
      this.axiosSuccessfulResponse(this),
      this.axiosErrorResponse(this)
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
  private axiosSuccessfulResponse(_this: CommonWellBase) {
    return (response: AxiosResponse): AxiosResponse => {
      _this && _this.postRequest(response);
      return response;
    };
  }
  private axiosErrorResponse(_this: CommonWellBase) {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (error: any): AxiosResponse => {
      _this && _this.postRequest(error.response);
      throw error;
    };
  }

  rethrowDescriptiveError(error: unknown, title: string): never {
    if (isAxiosError(error)) {
      if (error.response?.status === httpStatus.BAD_REQUEST) {
        const data = error.response?.data;
        throw new BadRequestError(title, undefined, { extra: JSON.stringify(data) });
      }

      if (error.response?.status === httpStatus.NOT_FOUND) {
        const data = error.response?.data;
        throw new MetriportError(title, undefined, { extra: JSON.stringify(data.help) });
      }
    }
    throw error;
  }
}
