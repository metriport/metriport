import { getNetworkErrorDetails } from "@metriport/shared";

class Response {
  status: number | undefined;
}

export type AdditionalInfo = {
  /**
   * The CommonWell correlation/log code.
   */
  cwReference?: string;
} & Record<string, string | number | undefined | null | Record<string, string>>;

export class CommonwellError extends Error {
  private _status: number | undefined;
  private _code: string | undefined;
  public readonly cwReference: string | undefined;

  constructor(
    message?: string | undefined,
    readonly cause?: any, //eslint-disable-line @typescript-eslint/no-explicit-any
    readonly additionalInfo?: AdditionalInfo
  ) {
    super(message);
    if (cause) {
      const { code, status } = getNetworkErrorDetails(cause);
      this._status = status;
      this._code = code;
    }
    this.cwReference = additionalInfo?.cwReference;
  }

  get status(): number | undefined {
    return this._status;
  }
  get code(): string | undefined {
    return this._code;
  }
  get response(): Response {
    return {
      status: this._status,
    };
  }
}
