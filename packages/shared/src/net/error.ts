import axios, { AxiosError } from "axios";
import { errorToString } from "../error/shared";

// https://nodejs.org/docs/latest-v18.x/api/errors.html#common-system-errors
export const nodeConnRefusedErrorCodes = ["ECONNREFUSED", "ECONNRESET"];
export type NodeConnRefusedNetworkError = (typeof nodeConnRefusedErrorCodes)[number];

export const nodeTimeoutErrorCodes = ["ETIMEDOUT"];
export type NodeTimeoutNetworkError = (typeof nodeTimeoutErrorCodes)[number];

export type NodeNetworkError = NodeTimeoutNetworkError | NodeConnRefusedNetworkError;

// Axios error codes that are timeout errors
export const axiosTimeoutErrorCodes: AxiosTimeoutError[] = [
  AxiosError.ECONNABORTED,
  AxiosError.ETIMEDOUT,
];
export type AxiosTimeoutError = typeof AxiosError.ETIMEDOUT | typeof AxiosError.ECONNABORTED;

export const networkTimeoutErrors = [...nodeTimeoutErrorCodes, ...axiosTimeoutErrorCodes];
export type NetworkTimeoutError = (typeof networkTimeoutErrors)[number];

export type NetworkError = NodeNetworkError | AxiosTimeoutError;

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
