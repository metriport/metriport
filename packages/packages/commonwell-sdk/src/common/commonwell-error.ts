import axios from "axios";

class Response {
  status: number | undefined;
}

export class CommonwellError extends Error {
  private _status: number | undefined;

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(message?: string | undefined, readonly cause?: any, readonly additionalInfo?: any) {
    super(message);
    if (cause) {
      if (axios.isAxiosError(cause)) {
        this._status = cause.response?.status;
      } else {
        this._status = cause.status;
      }
    }
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
