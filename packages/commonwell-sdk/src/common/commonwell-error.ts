import axios from "axios";

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
  public readonly cwReference: string | undefined;

  constructor(
    message?: string | undefined,
    readonly cause?: any, //eslint-disable-line @typescript-eslint/no-explicit-any
    readonly additionalInfo?: AdditionalInfo
  ) {
    super(message);
    if (cause) {
      if (axios.isAxiosError(cause)) {
        this._status = cause.response?.status;
      } else {
        this._status = cause.status;
      }
    }
    this.cwReference = additionalInfo?.cwReference;
  }

  get status(): number | undefined {
    return this._status;
  }
  get response(): Response {
    return {
      status: this._status,
    };
  }
}
