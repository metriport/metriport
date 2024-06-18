import { AxiosError } from "axios";

// https://nodejs.org/docs/latest-v18.x/api/errors.html#common-system-errors
export type NodeNetworkError = "ECONNREFUSED" | "ECONNRESET";

export type AxiosNetworkError =
  | typeof AxiosError.ETIMEDOUT
  | typeof AxiosError.ECONNABORTED
  | typeof AxiosError.ERR_BAD_RESPONSE;

export type NetworkError = NodeNetworkError | AxiosNetworkError;
