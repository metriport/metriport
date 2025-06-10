import axios, { AxiosError } from "axios";
import { errorToString } from "../error/shared";

// https://nodejs.org/docs/latest-v18.x/api/errors.html#common-system-errors
export const nodeConnRefusedErrorCodes = ["ECONNREFUSED", "ECONNRESET"] as const;
export type NodeConnRefusedNetworkError = (typeof nodeConnRefusedErrorCodes)[number];

export const nodeTimeoutErrorCodes = ["ETIMEDOUT"] as const;
export type NodeTimeoutNetworkError = (typeof nodeTimeoutErrorCodes)[number];

export const nodeNetworkErrorCodes = [
  ...nodeConnRefusedErrorCodes,
  ...nodeTimeoutErrorCodes,
  "ENOTFOUND",
] as const;
export type NodeNetworkError = (typeof nodeNetworkErrorCodes)[number];

// Axios error codes that are timeout errors
// https://github.com/axios/axios?tab=readme-ov-file#error-types

export const axiosTimeoutErrorCodes = [AxiosError.ECONNABORTED, AxiosError.ETIMEDOUT] as const;
export type AxiosTimeoutError = (typeof axiosTimeoutErrorCodes)[number];

export const axiosResponseErrorCodes = [AxiosError.ERR_BAD_RESPONSE] as const;
export type AxiosResponseError = (typeof axiosResponseErrorCodes)[number];

export const axiosNetworkErrors = [
  AxiosError.ERR_NETWORK,
  ...axiosResponseErrorCodes,
  ...axiosTimeoutErrorCodes,
] as const;
export type AxiosNetworkError = (typeof axiosNetworkErrors)[number];

// General Network errors

export const networkTimeoutErrors = [...nodeTimeoutErrorCodes, ...axiosTimeoutErrorCodes];
export type NetworkTimeoutError = (typeof networkTimeoutErrors)[number];

export const networkErrors = [...nodeNetworkErrorCodes, ...axiosNetworkErrors] as const;
export type NetworkError = (typeof networkErrors)[number];

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
