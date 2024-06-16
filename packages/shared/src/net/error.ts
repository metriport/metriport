import { AxiosError } from "axios";

// https://nodejs.org/docs/latest-v18.x/api/errors.html#common-system-errors
export type NodeNetworkError = "ECONNREFUSED" | "ECONNRESET";

export type AxiosNetworkError = typeof AxiosError.ETIMEDOUT | typeof AxiosError.ECONNABORTED;

export type NetworkError = NodeNetworkError | AxiosNetworkError;
