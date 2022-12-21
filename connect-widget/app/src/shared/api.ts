import axios, { AxiosInstance } from "axios";
import { URLSearchParams } from "url";
import Constants from "./constants";
import { isProdEnv, isSandbox } from "./util";

function buildBaseURL(searchParams: URLSearchParams): string {
  if (isProdEnv()) {
    const prefix = isSandbox(searchParams)
      ? process.env.REACT_APP_SANDBOX_API_URL_PREFIX
      : process.env.REACT_APP_API_URL_PREFIX;
    return `${prefix}.${process.env.REACT_APP_API_URL_DOMAIN}`;
  }
  return process.env.REACT_APP_API_URL!;
}

export const api = axios.create();

// get the session token in query params
export function getApiToken(searchParams: URLSearchParams): string {
  const apiToken = searchParams.get(Constants.TOKEN_PARAM);
  if (!apiToken) {
    throw new Error(`Missing query param ${Constants.TOKEN_PARAM}!`);
  }
  return apiToken;
}

// get the session token in query params, and set in the API headers
export function setupApi(api: AxiosInstance, searchParams: URLSearchParams) {
  api.defaults.baseURL = buildBaseURL(searchParams);
  if (isProdEnv()) {
    api.defaults.params = { state: getApiToken(searchParams) };
  } else {
    // insert the API token right into the headers, as we're bypassing
    // API Gateway in local envs
    api.defaults.headers.common["api-token"] = getApiToken(searchParams);
  }
}
