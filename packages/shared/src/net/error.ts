import axios, { AxiosError } from "axios";
import { errorToString } from "../error/shared";

// https://nodejs.org/docs/latest-v18.x/api/errors.html#common-system-errors
export const nodeConnRefusedErrorCodes = ["ECONNREFUSED", "ECONNRESET"] as const;
export type NodeConnRefusedNetworkError = (typeof nodeConnRefusedErrorCodes)[number];

export const nodeTimeoutErrorCodes = ["ETIMEDOUT"] as const;
export type NodeTimeoutNetworkError = (typeof nodeTimeoutErrorCodes)[number];

export type NodeNetworkError = NodeTimeoutNetworkError | NodeConnRefusedNetworkError | "ENOTFOUND";

// Axios error codes that are timeout errors

export const axiosTimeoutErrorCodes = [AxiosError.ECONNABORTED, AxiosError.ETIMEDOUT] as const;
export type AxiosTimeoutError = (typeof axiosTimeoutErrorCodes)[number];

export const axiosResponseErrorCodes = [AxiosError.ERR_BAD_RESPONSE] as const;
export type AxiosResponseError = (typeof axiosResponseErrorCodes)[number];

export type AxiosNetworkError = AxiosTimeoutError | AxiosResponseError;

// General Network errors

export const networkTimeoutErrors = [...nodeTimeoutErrorCodes, ...axiosTimeoutErrorCodes];
export type NetworkTimeoutError = (typeof networkTimeoutErrors)[number];

export type NetworkError = NodeNetworkError | AxiosNetworkError;

export function getNetworkErrorDetails(error: unknown): {
  details: string;
  code: string | undefined;
  status?: number | undefined;
} {
  const details = errorToString(error);
  if (axios.isAxiosError(error)) {
    return {
      details,
      code: error.code,
      status: error.response?.status,
    };
  }
  return { details, code: undefined, status: undefined };
}
