import axios, { AxiosInstance } from "axios";

const DEFAULT_TIMEOUT_MS = 20_000;

export function getHttpClient(timeoutInMs = DEFAULT_TIMEOUT_MS): AxiosInstance {
  return axios.create({
    timeout: timeoutInMs,
  });
}
